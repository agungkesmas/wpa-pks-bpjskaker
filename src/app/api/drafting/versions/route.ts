import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// GET /api/drafting/versions?pipeline_id=X
// List semua version per pipeline (untuk history tracking)
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const pipelineId = searchParams.get('pipeline_id')
    if (!pipelineId) return NextResponse.json({ error: 'pipeline_id wajib' }, { status: 400 })

    // Get pipeline untuk access control
    const { data: pipeline } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, faskes_id, kantor_cabang_id')
      .eq('id', pipelineId)
      .maybeSingle()
    if (!pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })

    // Access control
    if (me.role !== 'super_admin') {
      if (me.role === 'pic_rs' || me.role === 'legal_rs') {
        if (pipeline.faskes_id !== me.faskes_id) {
          return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
        }
      } else if (me.role === 'case_manager' || me.role === 'kepala_bidang') {
        if (pipeline.kantor_cabang_id !== me.kantor_cabang_id) {
          return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
        }
      }
    }

    const { data: versions, error } = await supabaseAdmin
      .from('wpa_pks_draft_versions')
      .select(`
        id,
        version,
        version_label,
        status,
        total_ayat,
        total_changes,
        total_outside_tolerance,
        edit_reason,
        cm_feedback,
        takeover_mode,
        final_file_url,
        final_file_name,
        edited_at,
        wpa_users!wpa_pks_draft_versions_edited_by_fkey(full_name, email, role)
      `)
      .eq('pipeline_id', pipelineId)
      .order('edited_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ data: versions || [] })
  } catch (e: any) {
    console.error('List versions error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
