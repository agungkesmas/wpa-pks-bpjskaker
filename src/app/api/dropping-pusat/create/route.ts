import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  // Batch header
  template_id: z.string().uuid().optional().nullable(),
  no_surat_pusat: z.string().min(3, 'No. surat pusat wajib diisi'),
  tanggal_surat_pusat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal: YYYY-MM-DD'),
  perihal: z.string().min(5, 'Perihal minimal 5 karakter'),
  surat_acuan_url: z.string().optional().or(z.literal('')),
  catatan: z.string().optional().or(z.literal('')),

  // Selected faskes (default ON — list of faskes_id that REMAIN CHECKED)
  // Faskes NOT in this list = excluded (must have reason in `exclusions`)
  selected_faskes_ids: z.array(z.string().uuid()),

  // Exclusions: faskes that were unchecked + wajib alasan
  exclusions: z.array(z.object({
    faskes_id: z.string().uuid(),
    alasan: z.string().min(5, 'Alasan exclude minimal 5 karakter'),
  })),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only CM and Kabid can broadcast dropping pusat
    if (me.role !== 'case_manager' && me.role !== 'kepala_bidang' && me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya CM/Kabid yang bisa broadcast Dropping Pusat' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })
    }

    const body = await req.json()
    const data = schema.parse(body)

    // Validate: every exclusion must have a real faskes_id (not in selected)
    const selectedSet = new Set(data.selected_faskes_ids)
    for (const ex of data.exclusions) {
      if (selectedSet.has(ex.faskes_id)) {
        return NextResponse.json({
          error: `Faskes ${ex.faskes_id} ada di both selected dan exclusions. Ini inconsistent.`
        }, { status: 400 })
      }
    }

    // Validate: at least 1 faskes must be selected (otherwise why broadcast?)
    if (data.selected_faskes_ids.length === 0) {
      return NextResponse.json({
        error: 'Minimal 1 faskes harus dipilih. Jika tidak ada yang relevan, gunakan menu lain.'
      }, { status: 400 })
    }

    // 1. Create the batch header
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from('wpa_dropping_pusat_batch')
      .insert({
        kantor_cabang_id: me.kantor_cabang_id,
        template_id: data.template_id || null,
        no_surat_pusat: data.no_surat_pusat,
        tanggal_surat_pusat: data.tanggal_surat_pusat,
        perihal: data.perihal,
        surat_acuan_url: data.surat_acuan_url || null,
        catatan: data.catatan || null,
        initiated_by: me.id,
        total_faskes_aktif: data.selected_faskes_ids.length + data.exclusions.length,
        total_faskes_diproses: data.selected_faskes_ids.length,
        total_faskes_dikecualikan: data.exclusions.length,
      })
      .select('id')
      .single()
    if (batchErr) throw batchErr

    // 2. Insert exclusion records (with wajib alasan)
    if (data.exclusions.length > 0) {
      const excludeRows = data.exclusions.map(ex => ({
        batch_id: batch.id,
        faskes_id: ex.faskes_id,
        alasan_exclude: ex.alasan,
        excluded_by: me.id,
      }))
      const { error: exErr } = await supabaseAdmin
        .from('wpa_dropping_pusat_exclude')
        .insert(excludeRows)
      if (exErr) throw exErr
    }

    // 3. Get SLA config for "drafting_adendum" (tahap 1 of dropping flow)
    const { data: tahapConfig } = await supabaseAdmin
      .from('wpa_pipeline_tahap_config')
      .select('default_sla_days')
      .eq('jenis_pipeline', 'adendum_dropping')
      .eq('tahap', 'drafting_adendum')
      .maybeSingle()
    const slaDays = tahapConfig?.default_sla_days || 14

    // 4. Create one pipeline per selected faskes
    // Assign initial handler = me (CM/Kabid who broadcast) — they will draft each
    const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

    // Fetch faskes details for pipeline rows + notifications
    const { data: faskesRows } = await supabaseAdmin
      .from('wpa_faskes')
      .select('id, nama, kantor_cabang_id')
      .in('id', data.selected_faskes_ids)

    const pipelineRows = (faskesRows || []).map(f => ({
      jenis: 'adendum_dropping',
      reference_id: batch.id,
      reference_type: 'dropping_batch',
      kantor_cabang_id: f.kantor_cabang_id,
      faskes_id: f.id,
      current_tahap: 'drafting_adendum',
      current_handler_id: me.id, // CM/Kabid yang broadcast = initial handler
      handler_since: new Date().toISOString(),
      cabang_owned: true,
      sla_deadline: slaDeadline,
      sla_breached: false,
      status: 'in_progress',
      initiated_by: me.id,
      dropping_batch_id: batch.id,
    }))

    const { data: pipelines, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .insert(pipelineRows)
      .select('id, faskes_id')
    if (pErr) throw pErr

    // 5. Insert pipeline logs (enter drafting_adendum)
    const logRows = (pipelines || []).map(p => ({
      pipeline_id: p.id,
      tahap: 'drafting_adendum',
      action: 'enter',
      performed_by: me.id,
      catatan: `Dropping Pusat broadcast — Batch ${batch.id}. No. Surat: ${data.no_surat_pusat}. Perihal: ${data.perihal}`,
      metadata: { batch_id: batch.id, no_surat_pusat: data.no_surat_pusat },
    }))
    const { error: logErr } = await supabaseAdmin
      .from('wpa_pipeline_log')
      .insert(logRows)
    if (logErr) throw logErr

    // 6. Notify PIC RS of each faskes (they will see it in their Pengajuan Saya list)
    const { data: userFaskesRows } = await supabaseAdmin
      .from('wpa_user_faskes')
      .select('user_id, faskes_id')
      .in('faskes_id', data.selected_faskes_ids)
      .eq('is_primary', true)

    const notifRows = (userFaskesRows || []).map(uf => {
      const faskes = (faskesRows || []).find(f => f.id === uf.faskes_id)
      const pipeline = (pipelines || []).find(p => p.faskes_id === uf.faskes_id)
      return {
        user_id: uf.user_id,
        kantor_cabang_id: me.kantor_cabang_id,
        type: 'dropping_pusat_received',
        title: 'Adendum Dropping Pusat Diterima',
        body: `Adendum dari kantor pusat: ${data.perihal}. No. Surat: ${data.no_surat_pusat}. Faskes Anda (${faskes?.nama || '-'}) tercatat sebagai target. CM/Kabid akan drafting adendum.`,
        related_entity: 'pipeline',
        related_id: pipeline?.id || null,
      }
    })
    if (notifRows.length > 0) {
      const { error: nErr } = await supabaseAdmin
        .from('wpa_notifications')
        .insert(notifRows)
      if (nErr) console.error('Notification insert error (non-fatal):', nErr)
    }

    // 7. Audit log
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id,
      action: 'dropping_pusat_broadcast',
      entity_type: 'dropping_batch',
      entity_id: batch.id,
      after_data: {
        no_surat_pusat: data.no_surat_pusat,
        perihal: data.perihal,
        total_diproses: data.selected_faskes_ids.length,
        total_dikecualikan: data.exclusions.length,
        exclusion_faskes_ids: data.exclusions.map(e => e.faskes_id),
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Dropping Pusat berhasil di-broadcast ke ${data.selected_faskes_ids.length} faskes. ${data.exclusions.length} faskes dikecualikan dengan alasan tercatat.`,
      batch_id: batch.id,
      total_diproses: data.selected_faskes_ids.length,
      total_dikecualikan: data.exclusions.length,
      pipeline_ids: (pipelines || []).map(p => p.id),
    })
  } catch (e: any) {
    console.error('Dropping pusat create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
