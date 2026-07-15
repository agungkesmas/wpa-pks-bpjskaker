import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// GET /api/adendum-masal/detail?id=<pipeline_id>
// Returns full detail of an adendum masal pipeline, including placeholder values
// and rendered HTML (placeholder values substituted into template).
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const pipelineId = searchParams.get('id')
    if (!pipelineId) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })

    const { data: pipeline, error } = await supabaseAdmin
      .from('wpa_pipeline')
      .select(`
        id,
        jenis,
        current_tahap,
        status,
        sla_deadline,
        initiated_at,
        completed_at,
        pdf_generated_url,
        template_id,
        faskes_id,
        kantor_cabang_id,
        wpa_faskes(nama, jenis, kota, alamat, penanggung_jawab_nama),
        wpa_pks_template(id, nama, judul_kartu, kode, version, file_docx_url, file_docx_path),
        wpa_pipeline_placeholder_values(placeholder_key, placeholder_value, placeholder_label),
        wpa_pipeline_log(id, tahap, action, catatan, performed_by, performed_at, wpa_users(full_name)),
        wpa_users!wpa_pipeline_initiated_by_fkey(full_name, email)
      `)
      .eq('id', pipelineId)
      .eq('jenis', 'adendum_masal')
      .maybeSingle()

    if (error) throw error
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

    return NextResponse.json({ data: pipeline })
  } catch (e: any) {
    console.error('Adendum masal detail error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
