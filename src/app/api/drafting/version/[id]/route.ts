import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// GET /api/drafting/version/[id]
// Detail 1 version (dengan content_html + char_counts)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data: version, error } = await supabaseAdmin
      .from('wpa_pks_draft_versions')
      .select(`
        id,
        pipeline_id,
        version,
        version_label,
        content_html,
        char_counts,
        total_ayat,
        total_changes,
        total_outside_tolerance,
        edit_reason,
        cm_feedback,
        status,
        takeover_mode,
        final_file_url,
        final_file_name,
        edited_at,
        wpa_users!wpa_pks_draft_versions_edited_by_fkey(full_name, email, role)
      `)
      .eq('id', id)
      .single()

    if (error || !version) return NextResponse.json({ error: 'Version tidak ditemukan' }, { status: 404 })

    // Access control via pipeline
    const { data: pipeline } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, faskes_id, kantor_cabang_id')
      .eq('id', version.pipeline_id)
      .maybeSingle()
    if (!pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })

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

    return NextResponse.json({ data: version })
  } catch (e: any) {
    console.error('Version detail error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
