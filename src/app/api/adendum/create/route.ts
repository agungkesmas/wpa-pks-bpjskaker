import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  jenis: z.enum(['adendum_harga', 'adendum_layanan_baru', 'perubahan_data']),
  judul: z.string().min(3, 'Judul minimal 3 karakter'),
  deskripsi_perubahan: z.string().min(10, 'Deskripsi minimal 10 karakter'),
  dokumen_pendukung_url: z.string().optional().or(z.literal('')),
  catatan: z.string().optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'pic_rs') return NextResponse.json({ error: 'Hanya PIC RS yang bisa ajukan adendum' }, { status: 403 })
    if (!me.faskes_id) return NextResponse.json({ error: 'Akun PIC RS tidak terikat faskes' }, { status: 400 })

    const body = await req.json()
    const data = schema.parse(body)

    // Get the active PKS for this faskes (adendum requires an active PKS)
    const { data: pks, error: pksErr } = await supabaseAdmin
      .from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, status')
      .eq('faskes_id', me.faskes_id)
      .eq('status', 'ditandatangani')
      .order('tanggal_berakhir', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pksErr) throw pksErr
    if (!pks) return NextResponse.json({ error: 'Tidak ada PKS aktif untuk faskes ini. Adendum hanya bisa diajukan jika PKS sudah ditandatangani.' }, { status: 400 })

    // Check if there's already an in-progress adendum of same jenis for this faskes
    const { data: existing } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, current_tahap')
      .eq('faskes_id', me.faskes_id)
      .eq('jenis', data.jenis)
      .eq('status', 'in_progress')
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({
        error: `Sudah ada pengajuan ${data.jenis.replace(/_/g, ' ')} yang sedang berjalan (tahap: ${existing.current_tahap}). Selesaikan atau batalkan dulu.`
      }, { status: 400 })
    }

    // Get kantor_cabang_id from faskes
    const { data: faskes } = await supabaseAdmin
      .from('wpa_faskes')
      .select('kantor_cabang_id, nama')
      .eq('id', me.faskes_id)
      .single()
    if (!faskes?.kantor_cabang_id) return NextResponse.json({ error: 'Faskes tidak terikat kantor cabang' }, { status: 400 })

    // Find CM in cabang to assign as initial handler (after pic_rs submit, next tahap = ditinjau)
    const { data: cm } = await supabaseAdmin
      .from('wpa_users')
      .select('id')
      .eq('kantor_cabang_id', faskes.kantor_cabang_id)
      .eq('role', 'case_manager')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    // Get SLA config for "ditinjau" tahap
    const { data: tahapConfig } = await supabaseAdmin
      .from('wpa_pipeline_tahap_config')
      .select('default_sla_days')
      .eq('jenis_pipeline', data.jenis)
      .eq('tahap', 'ditinjau_kajian_tarif')
      .maybeSingle()
    const slaDays = tahapConfig?.default_sla_days || 2

    // Create pipeline — adendum starts at "diajukan" then immediately advances to "ditinjau"
    // (PIC RS submit = auto-advance to CM review, like pks_baru)
    const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .insert({
        jenis: data.jenis,
        reference_id: pks.id,
        reference_type: 'pks',
        kantor_cabang_id: faskes.kantor_cabang_id,
        faskes_id: me.faskes_id,
        pks_id: pks.id,
        current_tahap: 'ditinjau_kajian_tarif', // auto-skip "diajukan" (PIC RS submit = done)
        current_handler_id: cm?.id || null,
        handler_since: new Date().toISOString(),
        cabang_owned: true,
        sla_deadline: slaDeadline,
        sla_breached: false,
        status: 'in_progress',
        initiated_by: me.id,
      })
      .select('id')
      .single()
    if (pErr) throw pErr

    // Insert pipeline log: enter "diajukan" then advance to "ditinjau"
    await supabaseAdmin.from('wpa_pipeline_log').insert([
      {
        pipeline_id: pipeline.id,
        tahap: 'diajukan',
        action: 'enter',
        performed_by: me.id,
        catatan: `Pengajuan ${data.jenis.replace(/_/g, ' ')}: ${data.judul}`,
      },
      {
        pipeline_id: pipeline.id,
        tahap: 'diajukan',
        action: 'complete',
        from_tahap: 'diajukan',
        to_tahap: 'ditinjau_kajian_tarif',
        performed_by: me.id,
        catatan: 'PIC RS submit form adendum',
      },
      {
        pipeline_id: pipeline.id,
        tahap: 'ditinjau_kajian_tarif',
        action: 'enter',
        performed_by: me.id,
        catatan: `Diteruskan ke CM untuk review. Judul: ${data.judul}`,
      },
    ])

    // Store adendum metadata (judul, deskripsi, dokumen_pendukung) in a metadata row
    // We use wpa_pipeline_log with action='submit' + metadata jsonb for the form data
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: pipeline.id,
      tahap: 'diajukan',
      action: 'submit',
      performed_by: me.id,
      catatan: data.catatan || null,
      metadata: {
        judul: data.judul,
        deskripsi_perubahan: data.deskripsi_perubahan,
        dokumen_pendukung_url: data.dokumen_pendukung_url || null,
        pks_id: pks.id,
        pks_kode: pks.kode_pks_pihak_pertama,
      },
    })

    // Notify CM
    if (cm?.id) {
      await supabaseAdmin.from('wpa_notifications').insert({
        user_id: cm.id,
        kantor_cabang_id: faskes.kantor_cabang_id,
        type: 'pipeline_tahap_baru',
        title: 'Pengajuan Adendum Baru',
        body: `${data.jenis.replace(/_/g, ' ').toUpperCase()} dari ${faskes.nama}: ${data.judul}. Mohon ditinjau.`,
        related_entity: 'pipeline',
        related_id: pipeline.id,
      })
    }

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: faskes.kantor_cabang_id,
      action: 'pipeline_create_adendum',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      after_data: { jenis: data.jenis, judul: data.judul, faskes_id: me.faskes_id, pks_id: pks.id },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Pengajuan adendum ${data.jenis.replace(/_/g, ' ')} berhasil dikirim ke CM`,
      pipeline_id: pipeline.id,
    })
  } catch (e: any) {
    console.error('Adendum create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
