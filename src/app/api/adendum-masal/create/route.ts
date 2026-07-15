import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  template_id: z.string().uuid(),
  placeholder_values: z.record(z.string(), z.string()).default({}),  // {key: value}
  catatan: z.string().optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'pic_rs') return NextResponse.json({ error: 'Hanya PIC RS' }, { status: 403 })
    if (!me.faskes_id) return NextResponse.json({ error: 'Akun PIC RS tidak terikat faskes' }, { status: 400 })

    const body = await req.json()
    const data = schema.parse(body)

    // 1. Validate template exists & is_masal=true & is_active=true
    const { data: template, error: tplErr } = await supabaseAdmin
      .from('wpa_pks_template')
      .select('id, nama, judul_kartu, is_masal, is_active, file_docx_url')
      .eq('id', data.template_id)
      .single()
    if (tplErr || !template) return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
    if (!template.is_masal) return NextResponse.json({ error: 'Template ini bukan template masal' }, { status: 400 })
    if (!template.is_active) return NextResponse.json({ error: 'Template sudah tidak aktif' }, { status: 400 })

    // 2. Validate: faskes must have active PKS (adendum requires PKS to exist)
    const { data: pks } = await supabaseAdmin
      .from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, status, kantor_cabang_id')
      .eq('faskes_id', me.faskes_id)
      .eq('status', 'ditandatangani')
      .order('tanggal_berakhir', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!pks) return NextResponse.json({ error: 'Faskes belum punya PKS aktif. Adendum masal hanya untuk faskes yang sudah ber-PKS.' }, { status: 400 })

    // 3. Validate: no in-progress adendum_masal with same template for this faskes
    const { data: existing } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, current_tahap, status')
      .eq('faskes_id', me.faskes_id)
      .eq('template_id', data.template_id)
      .eq('jenis', 'adendum_masal')
      .in('status', ['in_progress'])
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({
        error: `Sudah ada pengajuan adendum masal "${template.judul_kartu || template.nama}" yang sedang berjalan (tahap: ${existing.current_tahap}). Selesaikan atau batalkan dulu.`
      }, { status: 400 })
    }

    // 4. Get placeholder definitions (for labels + required validation)
    const { data: phDefs } = await supabaseAdmin
      .from('wpa_pks_template_placeholder')
      .select('key, label, tipe, required, urutan')
      .eq('template_id', data.template_id)
      .order('urutan', { ascending: true })

    // Validate required fields
    const missing: string[] = []
    ;(phDefs || []).forEach((p: any) => {
      if (p.required && !data.placeholder_values[p.key]?.trim()) {
        missing.push(p.label || p.key)
      }
    })
    if (missing.length > 0) {
      return NextResponse.json({ error: `Field wajib belum diisi: ${missing.join(', ')}` }, { status: 400 })
    }

    // 5. Get SLA for "diajukan" tahap (PIC RS submission)
    const { data: tahapConfig } = await supabaseAdmin
      .from('wpa_pipeline_tahap_config')
      .select('default_sla_days')
      .eq('jenis_pipeline', 'adendum_masal')
      .eq('tahap', 'diajukan')
      .maybeSingle()
    const slaDays = tahapConfig?.default_sla_days || 1
    const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

    // 6. Create pipeline
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .insert({
        jenis: 'adendum_masal',
        reference_id: pks.id,
        reference_type: 'pks',
        kantor_cabang_id: pks.kantor_cabang_id,
        faskes_id: me.faskes_id,
        pks_id: pks.id,
        template_id: data.template_id,
        current_tahap: 'diajukan',
        current_handler_id: me.id,
        handler_since: new Date().toISOString(),
        cabang_owned: false,  // PIC RS owned (not cabang)
        sla_deadline: slaDeadline,
        sla_breached: false,
        status: 'in_progress',
        initiated_by: me.id,
      })
      .select('id')
      .single()
    if (pErr) throw pErr

    // 7. Insert placeholder values
    if (Object.keys(data.placeholder_values).length > 0) {
      const rows = Object.entries(data.placeholder_values).map(([key, value]) => {
        const def = (phDefs || []).find((p: any) => p.key === key)
        return {
          pipeline_id: pipeline.id,
          template_id: data.template_id,
          placeholder_key: key,
          placeholder_value: value,
          placeholder_label: def?.label || key,
        }
      })
      const { error: phErr } = await supabaseAdmin
        .from('wpa_pipeline_placeholder_values')
        .upsert(rows, { onConflict: 'pipeline_id,placeholder_key' })
      if (phErr) throw phErr
    }

    // 8. Insert pipeline log
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: pipeline.id,
      tahap: 'diajukan',
      action: 'enter',
      performed_by: me.id,
      catatan: `Adendum masal "${template.judul_kartu || template.nama}" diajukan oleh PIC RS${data.catatan ? `. Catatan: ${data.catatan}` : ''}`,
    })

    // 9. Notify CM
    const { data: cm } = await supabaseAdmin
      .from('wpa_users')
      .select('id')
      .eq('kantor_cabang_id', pks.kantor_cabang_id)
      .eq('role', 'case_manager')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (cm?.id) {
      const { data: faskes } = await supabaseAdmin
        .from('wpa_faskes')
        .select('nama')
        .eq('id', me.faskes_id)
        .single()
      await supabaseAdmin.from('wpa_notifications').insert({
        user_id: cm.id,
        kantor_cabang_id: pks.kantor_cabang_id,
        type: 'pipeline_tahap_baru',
        title: 'Adendum Masal Baru untuk Ditinjau',
        body: `${faskes?.nama || 'Faskes'} mengajukan adendum masal "${template.judul_kartu || template.nama}". Mohon ditinjau di tab Adendum Masal.`,
        related_entity: 'pipeline',
        related_id: pipeline.id,
      })
    }

    // 10. Audit log
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pks.kantor_cabang_id,
      action: 'adendum_masal_create',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      after_data: { template_id: data.template_id, template_nama: template.nama, placeholder_count: Object.keys(data.placeholder_values).length },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Adendum masal "${template.judul_kartu || template.nama}" berhasil dikirim ke CM`,
      pipeline_id: pipeline.id,
    })
  } catch (e: any) {
    console.error('Adendum masal create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
