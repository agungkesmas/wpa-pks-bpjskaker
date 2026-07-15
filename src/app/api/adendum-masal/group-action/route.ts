import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pipeline_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 pipeline'),
  action: z.enum(['approve', 'reject']),
  catatan: z.string().optional().or(z.literal('')),
})

// POST /api/adendum-masal/group-action
// CM group review: ceklis multiple pipelines → approve/reject bareng.
// - approve: pipeline auto-complete (status=completed, current_tahap=completed).
//            Note: PDF generation happens on demand when PIC RS clicks "Print PDF".
// - reject: pipeline closed (status=rejected). PIC RS terima notif + alasan.
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['case_manager', 'super_admin'].includes(me.role)) {
      return NextResponse.json({ error: 'Hanya CM atau SuperAdmin yang bisa group review' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })
    }

    const body = await req.json()
    const data = schema.parse(body)

    // 1. Get all pipelines
    const { data: pipelines, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, jenis, current_tahap, status, kantor_cabang_id, faskes_id, template_id, initiated_by')
      .in('id', data.pipeline_ids)
      .eq('jenis', 'adendum_masal')
    if (pErr) throw pErr

    // 2. Validate all are in "diajukan" tahap & belong to my cabang
    const invalid: string[] = []
    for (const p of (pipelines || [])) {
      if (p.kantor_cabang_id !== me.kantor_cabang_id && me.role !== 'super_admin') {
        invalid.push(`${p.id} (bukan cabang Anda)`)
      }
      if (p.current_tahap !== 'diajukan' || p.status !== 'in_progress') {
        invalid.push(`${p.id} (tahap: ${p.current_tahap}, status: ${p.status})`)
      }
    }
    if (invalid.length > 0) {
      return NextResponse.json({
        error: `Beberapa pipeline tidak bisa diproses: ${invalid.join(', ')}`
      }, { status: 400 })
    }

    const validPipelines = pipelines || []
    if (validPipelines.length === 0) {
      return NextResponse.json({ error: 'Tidak ada pipeline valid untuk diproses' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updatedIds: string[] = []

    if (data.action === 'approve') {
      // 3a. Approve: complete all pipelines
      const { error: updErr } = await supabaseAdmin
        .from('wpa_pipeline')
        .update({
          status: 'completed',
          current_tahap: 'completed',
          current_handler_id: null,
          completed_at: now,
          updated_at: now,
        })
        .in('id', data.pipeline_ids)
      if (updErr) throw updErr
      updatedIds.push(...data.pipeline_ids)

      // Insert logs: complete diajukan + complete pipeline
      const logRows: any[] = []
      for (const p of validPipelines) {
        logRows.push({
          pipeline_id: p.id,
          tahap: 'diajukan',
          action: 'complete',
          from_tahap: 'diajukan',
          to_tahap: 'completed',
          performed_by: me.id,
          catatan: `Disetujui CM (group review). ${data.catatan || ''}`.trim(),
        })
        logRows.push({
          pipeline_id: p.id,
          tahap: 'completed',
          action: 'enter',
          performed_by: me.id,
          catatan: 'Pipeline completed. PDF siap di-print untuk TTD basah.',
        })
      }
      await supabaseAdmin.from('wpa_pipeline_log').insert(logRows)

      // Notify PIC RS per pipeline
      const notifRows = validPipelines.map(p => ({
        user_id: p.initiated_by,
        kantor_cabang_id: p.kantor_cabang_id,
        type: 'pipeline_completed',
        title: 'Adendum Masal Disetujui CM',
        body: `Adendum masal Anda telah disetujui CM. PDF siap untuk di-print dan ditandatangani basah.`,
        related_entity: 'pipeline',
        related_id: p.id,
      }))
      await supabaseAdmin.from('wpa_notifications').insert(notifRows)

    } else {
      // 3b. Reject: close all pipelines with status=rejected
      const { error: updErr } = await supabaseAdmin
        .from('wpa_pipeline')
        .update({
          status: 'rejected',
          current_handler_id: null,
          completed_at: now,
          updated_at: now,
        })
        .in('id', data.pipeline_ids)
      if (updErr) throw updErr
      updatedIds.push(...data.pipeline_ids)

      // Insert logs
      const logRows: any[] = []
      for (const p of validPipelines) {
        logRows.push({
          pipeline_id: p.id,
          tahap: 'diajukan',
          action: 'reject',
          performed_by: me.id,
          catatan: `Ditolak CM (group review). Alasan: ${data.catatan || 'Tidak sesuai'}`,
        })
      }
      await supabaseAdmin.from('wpa_pipeline_log').insert(logRows)

      // Notify PIC RS per pipeline
      const notifRows = validPipelines.map(p => ({
        user_id: p.initiated_by,
        kantor_cabang_id: p.kantor_cabang_id,
        type: 'pipeline_rejected',
        title: 'Adendum Masal Ditolak CM',
        body: `Adendum masal Anda ditolak CM. Alasan: ${data.catatan || 'Tidak sesuai'}`,
        related_entity: 'pipeline',
        related_id: p.id,
      }))
      await supabaseAdmin.from('wpa_notifications').insert(notifRows)
    }

    // 4. Audit log (one entry for the group action)
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id,
      action: data.action === 'approve' ? 'adendum_masal_group_approve' : 'adendum_masal_group_reject',
      entity_type: 'pipeline',
      entity_id: data.pipeline_ids[0],
      after_data: {
        pipeline_ids: data.pipeline_ids,
        total: data.pipeline_ids.length,
        catatan: data.catatan || null,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `${data.action === 'approve' ? 'Setujui' : 'Tolak'} ${data.pipeline_ids.length} pengajuan adendum masal sekaligus.`,
      processed_count: data.pipeline_ids.length,
      action: data.action,
    })
  } catch (e: any) {
    console.error('Adendum masal group action error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
