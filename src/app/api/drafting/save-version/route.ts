import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pipeline_id: z.string().uuid(),
  content_html: z.string().min(10, 'Content HTML tidak boleh kosong'),
  char_counts: z.record(z.string(), z.any()).default({}),
  edit_reason: z.string().optional().or(z.literal('')),
  cm_feedback: z.string().optional().or(z.literal('')),
})

// POST /api/drafting/save-version
// PIC RS save draft version (v1, v2, v3, v4)
// Aturan:
// - Max 4 iterasi (v1-v4). Setelah v4, kalau CM return → CM takeover
// - Kalau ada ayat outside tolerance, edit_reason wajib
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const data = schema.parse(body)

    // Get pipeline
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, jenis, current_tahap, status, faskes_id, kantor_cabang_id, initiated_by, draft_iteration')
      .eq('id', data.pipeline_id)
      .single()
    if (pErr || !pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })

    // Access control: PIC RS (owner) atau CM/Kabid (cabang)
    if (me.role !== 'super_admin') {
      if (me.role === 'pic_rs') {
        if (pipeline.faskes_id !== me.faskes_id) {
          return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
        }
      } else if (me.role === 'case_manager' || me.role === 'kepala_bidang') {
        if (pipeline.kantor_cabang_id !== me.kantor_cabang_id) {
          return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
      }
    }

    // Pipeline harus di tahap drafting_pks
    if (pipeline.current_tahap !== 'drafting_pks') {
      return NextResponse.json({
        error: `Pipeline harus di tahap drafting_pks. Saat ini: ${pipeline.current_tahap}`
      }, { status: 400 })
    }

    // Cek iterasi saat ini
    const currentIteration = pipeline.draft_iteration || 0
    const nextVersion = currentIteration + 1

    if (nextVersion > 4) {
      return NextResponse.json({
        error: 'Maksimal 4 iterasi draft sudah tercapai. CM harus takeover.'
      }, { status: 400 })
    }

    // Validate: kalau ada outside tolerance, edit_reason wajib
    const charCounts = data.char_counts || {}
    const outsideToleranceAyats = Object.entries(charCounts).filter(([_, v]: [string, any]) =>
      v.within_tolerance === false
    )

    if (outsideToleranceAyats.length > 0 && (!data.edit_reason || data.edit_reason.trim().length < 5)) {
      return NextResponse.json({
        error: `Ada ${outsideToleranceAyats.length} ayat dengan perubahan di luar tolerance. Alasan edit wajib diisi (minimal 5 karakter).`,
        outside_tolerance_ayats: outsideToleranceAyats.map(([k]) => k),
      }, { status: 400 })
    }

    // Calculate summary stats
    const totalAyat = Object.keys(charCounts).length
    const totalChanges = Object.entries(charCounts).filter(([_, v]: [string, any]) => v.delta !== 0).length
    const totalOutside = outsideToleranceAyats.length

    // Insert new version
    const { data: version, error: vErr } = await supabaseAdmin
      .from('wpa_pks_draft_versions')
      .insert({
        pipeline_id: data.pipeline_id,
        version: nextVersion,
        version_label: 'draft',
        content_html: data.content_html,
        char_counts: charCounts,
        total_ayat: totalAyat,
        total_changes: totalChanges,
        total_outside_tolerance: totalOutside,
        edited_by: me.id,
        edit_reason: data.edit_reason || null,
        cm_feedback: data.cm_feedback || null,
        status: 'draft',
      })
      .select('id, version')
      .single()
    if (vErr) throw vErr

    // Update pipeline: increment draft_iteration + set current_draft_version_id
    await supabaseAdmin
      .from('wpa_pipeline')
      .update({
        draft_iteration: nextVersion,
        current_draft_version_id: version.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.pipeline_id)

    // Log
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: data.pipeline_id,
      tahap: 'drafting_pks',
      action: 'submit',
      performed_by: me.id,
      catatan: `Draft v${nextVersion} disubmit oleh ${me.role === 'pic_rs' ? 'PIC RS' : 'CM'}. ${totalChanges} perubahan, ${totalOutside} outside tolerance.${data.edit_reason ? ` Alasan: ${data.edit_reason}` : ''}`,
      metadata: { version_id: version.id, version: nextVersion, total_changes: totalChanges, total_outside: totalOutside },
    })

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pipeline.kantor_cabang_id || undefined,
      action: 'drafting_save_version',
      entity_type: 'wpa_pks_draft_versions',
      entity_id: version.id,
      after_data: {
        pipeline_id: data.pipeline_id,
        version: nextVersion,
        total_changes: totalChanges,
        total_outside_tolerance: totalOutside,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Draft v${nextVersion} berhasil disimpan. CM akan review.${nextVersion === 4 ? ' Ini iterasi terakhir — kalau CM return, CM akan takeover.' : ''}`,
      version_id: version.id,
      version: nextVersion,
      total_changes: totalChanges,
      total_outside_tolerance: totalOutside,
      remaining_iterations: 4 - nextVersion,
    })
  } catch (e: any) {
    console.error('Save version error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
