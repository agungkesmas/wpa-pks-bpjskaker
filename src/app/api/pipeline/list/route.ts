import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const jenis = searchParams.get('jenis')
    const status = searchParams.get('status')
    const tahap = searchParams.get('tahap')
    const handler_only = searchParams.get('handler_only') === 'true'
    const cabang_only = searchParams.get('cabang_only') === 'true'
    const initiated_by_me = searchParams.get('initiated_by_me') === 'true'
    const review_for_me = searchParams.get('review_for_me') === 'true'
    const include_all_status = searchParams.get('include_all_status') === 'true'

    let query = supabaseAdmin
      .from('wpa_pipeline')
      .select(`
        id,
        jenis,
        current_tahap,
        status,
        sla_deadline,
        sla_breached,
        current_handler_id,
        handler_since,
        takeover_enabled,
        faskes_id,
        kantor_cabang_id,
        pks_id,
        initiated_by,
        initiated_at,
        updated_at,
        completed_at,
        wpa_faskes(nama, jenis, tipe, kota),
        wpa_kantor_cabang(nama, kode),
        wpa_pks(id, kode_pks_pihak_pertama, tanggal_berakhir),
        wpa_users!wpa_pipeline_initiated_by_fkey(id, full_name, email, role, phone)
      `)
      .order('updated_at', { ascending: false })

    // === ROLE-BASED FILTERING ===
    if (me.role === 'pic_rs' || me.role === 'legal_rs') {
      const { data: userFaskes } = await supabaseAdmin
        .from('wpa_user_faskes')
        .select('faskes_id')
        .eq('user_id', me.id)
      const faskesIds = (userFaskes || []).map(uf => uf.faskes_id)

      if (initiated_by_me) {
        query = query.eq('initiated_by', me.id)
      } else if (review_for_me && me.role === 'legal_rs') {
        query = query.eq('current_tahap', 'review_legal_rs').in('faskes_id', faskesIds)
      } else {
        query = query.in('faskes_id', faskesIds.length > 0 ? faskesIds : ['00000000-0000-0000-0000-000000000000'])
      }
    } else if (me.role === 'penata_pelayanan') {
      if (handler_only) {
        query = query.eq('current_handler_id', me.id)
      } else if (cabang_only) {
        query = query.eq('kantor_cabang_id', me.kantor_cabang_id).eq('takeover_enabled', true)
      } else {
        query = query.or(`current_handler_id.eq.${me.id},and(kantor_cabang_id.eq.${me.kantor_cabang_id},takeover_enabled.eq.true)`)
      }
    } else if (me.role === 'case_manager') {
      if (handler_only) {
        query = query.eq('current_handler_id', me.id)
      } else if (cabang_only) {
        query = query.eq('kantor_cabang_id', me.kantor_cabang_id)
      } else {
        query = query.eq('kantor_cabang_id', me.kantor_cabang_id)
      }
    } else if (me.role === 'kepala_bidang') {
      query = query.eq('kantor_cabang_id', me.kantor_cabang_id)
      if (tahap === 'approval_kabid') {
        query = query.eq('current_tahap', 'approval_kabid')
      }
    }

    // === STATUS FILTERING ===
    // Default: hanya in_progress (exclude cancelled, rejected, completed)
    // Kecuali user explicitly request status lain via `?status=X`
    // atau `?include_all_status=true`
    if (status) {
      query = query.eq('status', status)
    } else if (!include_all_status && !initiated_by_me) {
      // initiated_by_me = PIC RS lihat semua pengajuannya (termasuk cancelled/rejected)
      // Tapi untuk CM/Kabid/PP, default hanya in_progress
      if (me.role !== 'pic_rs' && me.role !== 'legal_rs') {
        query = query.eq('status', 'in_progress')
      }
    }

    if (jenis) query = query.eq('jenis', jenis)
    if (tahap) query = query.eq('current_tahap', tahap)

    const { data, error } = await query.limit(100)
    if (error) throw error

    // Enrich: hitung dokumen count per pipeline (parallel)
    const pipelines = data || []
    if (pipelines.length > 0) {
      const pipelineIds = pipelines.map((p: any) => p.id)
      const { data: docCounts } = await supabaseAdmin
        .from('wpa_pengajuan_dokumen')
        .select('pipeline_id')
        .in('pipeline_id', pipelineIds)

      const docCountMap: Record<string, number> = {}
      ;(docCounts || []).forEach((d: any) => {
        docCountMap[d.pipeline_id] = (docCountMap[d.pipeline_id] || 0) + 1
      })

      pipelines.forEach((p: any) => {
        p.dokumen_count = docCountMap[p.id] || 0
      })
    }

    return NextResponse.json({ data: pipelines })
  } catch (e: any) {
    console.error('Pipeline list error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
