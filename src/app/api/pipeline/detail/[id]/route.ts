import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    
    const { data: pipeline, error } = await supabaseAdmin
      .from('wpa_pipeline')
      .select(`
        *,
        wpa_faskes(*),
        wpa_kantor_cabang(nama, kode, alamat, kota, telp)
      `)
      .eq('id', id)
      .single()
    if (error || !pipeline) {
      return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })
    }
    
    // Access control
    if (me.role === 'pic_rs' || me.role === 'legal_rs') {
      const { data: uf } = await supabaseAdmin
        .from('wpa_user_faskes')
        .select('faskes_id')
        .eq('user_id', me.id)
        .eq('faskes_id', pipeline.faskes_id)
      if (!uf || uf.length === 0) {
        return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
      }
    } else if (me.role === 'penata_pelayanan') {
      if (pipeline.current_handler_id !== me.id && !pipeline.takeover_enabled && me.kantor_cabang_id !== pipeline.kantor_cabang_id) {
        return NextResponse.json({ error: 'Akses Penata Pelayanan belum dibuka' }, { status: 403 })
      }
    } else if (['case_manager', 'kepala_bidang'].includes(me.role)) {
      if (me.kantor_cabang_id !== pipeline.kantor_cabang_id) {
        return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
      }
    }
    
    const [logsRes, tahapRes, docsRes, aclRes] = await Promise.all([
      supabaseAdmin.from('wpa_pipeline_log')
        .select('id, tahap, action, performed_by, performed_at, catatan, sla_actual_hours, wpa_users(email, full_name, role)')
        .eq('pipeline_id', id).order('performed_at', { ascending: true }),
      supabaseAdmin.from('wpa_pipeline_tahap_config')
        .select('*').eq('jenis_pipeline', pipeline.jenis).order('urutan', { ascending: true }),
      supabaseAdmin.from('wpa_pengajuan_dokumen')
        .select('*').eq('pipeline_id', id).order('uploaded_at', { ascending: false }),
      supabaseAdmin.from('wpa_pipeline_access_control')
        .select('id, action, performed_by, performed_at, reason, wpa_users(email, full_name, role)')
        .eq('pipeline_id', id).order('performed_at', { ascending: true }),
    ])
    
    // Fetch placeholder values + template (untuk adendum_masal)
    let placeholderValues: any[] = []
    let templateInfo: any = null
    if (pipeline.jenis === 'adendum_masal' && pipeline.template_id) {
      const [phRes, tplRes] = await Promise.all([
        supabaseAdmin.from('wpa_pipeline_placeholder_values')
          .select('placeholder_key, placeholder_value, placeholder_label')
          .eq('pipeline_id', id),
        supabaseAdmin.from('wpa_pks_template')
          .select('id, nama, judul_kartu, kode, version')
          .eq('id', pipeline.template_id)
          .maybeSingle(),
      ])
      placeholderValues = phRes.data || []
      templateInfo = tplRes.data
    }

    return NextResponse.json({
      data: {
        ...pipeline,
        logs: logsRes.data || [],
        tahap_config: tahapRes.data || [],
        documents: docsRes.data || [],
        wpa_pengajuan_dokumen: docsRes.data || [],  // alias for PipelineDetailView
        access_logs: aclRes.data || [],
        wpa_pipeline_placeholder_values: placeholderValues,
        wpa_pks_template: templateInfo,
      }
    })
  } catch (e: any) {
    console.error('Pipeline detail error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
