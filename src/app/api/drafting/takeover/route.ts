import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pipeline_id: z.string().uuid(),
  takeover_mode: z.enum(['system_edit', 'file_upload']),

  // Untuk system_edit mode
  content_html: z.string().optional(),
  char_counts: z.record(z.string(), z.any()).optional(),
  edit_reason: z.string().optional().or(z.literal('')),

  // Untuk file_upload mode
  final_file_url: z.string().optional(),
  final_file_name: z.string().optional(),

  catatan: z.string().optional().or(z.literal('')),
})

// POST /api/drafting/takeover
// CM takeover (setelah 4x koreksi PIC RS gagal):
// - system_edit: CM edit langsung di sistem (TipTap), simpan sebagai version FINAL
// - file_upload: CM upload file Word/PDF final
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'case_manager' && me.role !== 'kepala_bidang' && me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya CM/Kabid yang bisa takeover' }, { status: 403 })
    }

    const body = await req.json()
    const data = schema.parse(body)

    // Get pipeline
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, jenis, current_tahap, status, kantor_cabang_id, faskes_id, draft_iteration')
      .eq('id', data.pipeline_id)
      .single()
    if (pErr || !pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })

    // Access control
    if (me.role !== 'super_admin' && pipeline.kantor_cabang_id !== me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
    }

    // Pipeline harus di tahap drafting_pks
    if (pipeline.current_tahap !== 'drafting_pks') {
      return NextResponse.json({
        error: `Pipeline harus di tahap drafting_pks. Saat ini: ${pipeline.current_tahap}`
      }, { status: 400 })
    }

    // Validate based on mode
    if (data.takeover_mode === 'system_edit') {
      if (!data.content_html || data.content_html.length < 10) {
        return NextResponse.json({ error: 'Content HTML wajib untuk system_edit mode' }, { status: 400 })
      }
    } else if (data.takeover_mode === 'file_upload') {
      if (!data.final_file_url || !data.final_file_name) {
        return NextResponse.json({ error: 'File URL dan nama wajib untuk file_upload mode' }, { status: 400 })
      }
    }

    // Calculate char counts summary (untuk system_edit)
    let totalAyat = 0, totalChanges = 0, totalOutside = 0
    if (data.takeover_mode === 'system_edit' && data.char_counts) {
      const charCounts = data.char_counts
      totalAyat = Object.keys(charCounts).length
      totalChanges = Object.entries(charCounts).filter(([_, v]: [string, any]) => v.delta !== 0).length
      totalOutside = Object.entries(charCounts).filter(([_, v]: [string, any]) => v.within_tolerance === false).length
    }

    // Insert FINAL version
    const { data: finalVersion, error: vErr } = await supabaseAdmin
      .from('wpa_pks_draft_versions')
      .insert({
        pipeline_id: data.pipeline_id,
        version: null,  // final tidak punya version number
        version_label: 'final',
        content_html: data.content_html || '<p>File final di-upload oleh CM. Lihat link file.</p>',
        char_counts: data.char_counts || {},
        total_ayat: totalAyat,
        total_changes: totalChanges,
        total_outside_tolerance: totalOutside,
        edited_by: me.id,
        edit_reason: data.edit_reason || `CM takeover (${data.takeover_mode})`,
        status: 'final',
        takeover_mode: data.takeover_mode,
        final_file_url: data.final_file_url || null,
        final_file_name: data.final_file_name || null,
      })
      .select('id')
      .single()
    if (vErr) throw vErr

    // Update pipeline: set current_draft_version_id + advance ke tanda_tangan
    const { TAHAP_FLOW } = await import('@/lib/wpa-constants')
    const flow = TAHAP_FLOW[pipeline.jenis]
    const currentStep = flow?.find((s: any) => s.current === pipeline.current_tahap)
    const nextTahap = currentStep?.next

    const { data: tahapConfig } = await supabaseAdmin
      .from('wpa_pipeline_tahap_config')
      .select('default_sla_days')
      .eq('jenis_pipeline', pipeline.jenis)
      .eq('tahap', nextTahap)
      .maybeSingle()
    const slaDays = tahapConfig?.default_sla_days || 3
    const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

    await supabaseAdmin
      .from('wpa_pipeline')
      .update({
        current_draft_version_id: finalVersion.id,
        current_tahap: nextTahap,
        sla_deadline: slaDeadline,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.pipeline_id)

    // Log
    await supabaseAdmin.from('wpa_pipeline_log').insert([
      {
        pipeline_id: data.pipeline_id,
        tahap: 'drafting_pks',
        action: 'complete',
        from_tahap: 'drafting_pks',
        to_tahap: nextTahap,
        performed_by: me.id,
        catatan: `CM TAKEOVER — mode: ${data.takeover_mode}. Draft final disimpan.${data.catatan ? ` Catatan: ${data.catatan}` : ''}`,
        metadata: { takeover_mode: data.takeover_mode, final_version_id: finalVersion.id },
      },
      {
        pipeline_id: data.pipeline_id,
        tahap: nextTahap,
        action: 'enter',
        performed_by: me.id,
        catatan: `Pipeline masuk tahap ${nextTahap} (setelah CM takeover)`,
      },
    ])

    // Notify PIC RS
    const { data: picRsUsers } = await supabaseAdmin
      .from('wpa_users')
      .select('id')
      .eq('faskes_id', pipeline.faskes_id || null)
      .eq('role', 'pic_rs')
      .eq('is_active', true)
    if (picRsUsers && picRsUsers.length > 0) {
      await supabaseAdmin.from('wpa_notifications').insert(
        picRsUsers.map(u => ({
          user_id: u.id,
          kantor_cabang_id: pipeline.kantor_cabang_id,
          type: 'draft_final_ready',
          title: 'Draft PKS Final — Siap Print',
          body: `CM sudah finalize draft PKS (takeover ${data.takeover_mode === 'system_edit' ? 'edit di sistem' : 'upload file'}). Silakan print untuk tanda tangan basah.`,
          related_entity: 'pipeline',
          related_id: data.pipeline_id,
        }))
      )
    }

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pipeline.kantor_cabang_id || undefined,
      action: 'drafting_cm_takeover',
      entity_type: 'wpa_pks_draft_versions',
      entity_id: finalVersion.id,
      after_data: {
        pipeline_id: data.pipeline_id,
        takeover_mode: data.takeover_mode,
        final_version_id: finalVersion.id,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Takeover berhasil (${data.takeover_mode}). Draft final siap di-print oleh PIC RS.`,
      final_version_id: finalVersion.id,
    })
  } catch (e: any) {
    console.error('Takeover error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
