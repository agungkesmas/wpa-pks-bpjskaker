import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'
import { validateDokumen, getDokumenLabel } from '@/lib/wpa-constants'

// POST /api/pengajuan-draft/submit
// Validate all wajib files are uploaded, then advance pipeline from 'diajukan' → 'ditinjau'
// and notify CM.
const schema = z.object({
  pipeline_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const data = schema.parse(body)

    // Get pipeline
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('*')
      .eq('id', data.pipeline_id)
      .single()
    if (pErr || !pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })

    // Access control
    if (me.role !== 'super_admin') {
      if (me.role === 'pic_rs') {
        if (pipeline.faskes_id !== me.faskes_id) {
          return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Hanya PIC RS atau SuperAdmin yang bisa submit draft' }, { status: 403 })
      }
    }

    if (pipeline.current_tahap !== 'diajukan') {
      return NextResponse.json({
        error: `Pipeline sudah di-submit (tahap saat ini: ${pipeline.current_tahap})`
      }, { status: 400 })
    }

    // Validate all wajib files uploaded
    const { data: docs } = await supabaseAdmin
      .from('wpa_pengajuan_dokumen')
      .select('jenis')
      .eq('pipeline_id', pipeline.id)
    const uploadedJenisList = (docs || []).map(d => d.jenis)
    const { valid, missing } = validateDokumen(pipeline.jenis, uploadedJenisList)

    if (!valid) {
      const missingLabels = missing.map(j => getDokumenLabel(j))
      return NextResponse.json({
        error: `File wajib belum lengkap. Kurang: ${missingLabels.join(', ')}`
      }, { status: 400 })
    }

    // Find CM in cabang to assign as next handler
    const { data: cm } = await supabaseAdmin
      .from('wpa_users')
      .select('id')
      .eq('kantor_cabang_id', pipeline.kantor_cabang_id)
      .eq('role', 'case_manager')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    // Get SLA for 'ditinjau' tahap
    const { data: tahapConfig } = await supabaseAdmin
      .from('wpa_pipeline_tahap_config')
      .select('default_sla_days')
      .eq('jenis_pipeline', pipeline.jenis)
      .eq('tahap', 'ditinjau')
      .maybeSingle()
    const slaDays = tahapConfig?.default_sla_days || 2
    const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

    // Update pipeline: advance to 'ditinjau'
    const { error: updErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .update({
        current_tahap: 'ditinjau',
        current_handler_id: cm?.id || null,
        handler_since: new Date().toISOString(),
        sla_deadline: slaDeadline,
        sla_breached: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pipeline.id)
    if (updErr) throw updErr

    // Insert logs: complete diajukan + enter ditinjau
    await supabaseAdmin.from('wpa_pipeline_log').insert([
      {
        pipeline_id: pipeline.id,
        tahap: 'diajukan',
        action: 'complete',
        from_tahap: 'diajukan',
        to_tahap: 'ditinjau',
        performed_by: me.id,
        catatan: 'PIC RS submit dengan semua file wajib lengkap',
      },
      {
        pipeline_id: pipeline.id,
        tahap: 'ditinjau',
        action: 'enter',
        performed_by: me.id,
        catatan: 'Diteruskan ke CM untuk review dokumen',
      },
    ])

    // Notify CM
    if (cm?.id) {
      const { data: faskes } = await supabaseAdmin
        .from('wpa_faskes')
        .select('nama')
        .eq('id', pipeline.faskes_id)
        .single()
      await supabaseAdmin.from('wpa_notifications').insert({
        user_id: cm.id,
        kantor_cabang_id: pipeline.kantor_cabang_id,
        type: 'pipeline_tahap_baru',
        title: 'Pengajuan Baru untuk Ditinjau',
        body: `${pipeline.jenis.replace(/_/g, ' ').toUpperCase()} dari ${faskes?.nama || 'faskes'}. Semua file wajib sudah lengkap. Mohon ditinjau.`,
        related_entity: 'pipeline',
        related_id: pipeline.id,
      })
    }

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pipeline.kantor_cabang_id,
      action: 'pipeline_draft_submit',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      after_data: { from: 'diajukan', to: 'ditinjau', total_files: uploadedJenisList.length },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: 'Pengajuan berhasil dikirim ke CM. Semua file wajib sudah terlampir.',
      pipeline_id: pipeline.id,
    })
  } catch (e: any) {
    console.error('Draft submit error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
