import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// GET /api/adendum-masal/list-pending
// Returns all adendum_masal pipelines with status in_progress, grouped by template.
// CM uses this for group review (ceklis multi → setuju/tolak bareng).
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['case_manager', 'kepala_bidang', 'super_admin'].includes(me.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const templateId = searchParams.get('template_id')
    const status = searchParams.get('status') || 'in_progress'

    let query = supabaseAdmin
      .from('wpa_pipeline')
      .select(`
        id,
        jenis,
        current_tahap,
        status,
        sla_deadline,
        sla_breached,
        initiated_at,
        completed_at,
        catatan,
        template_id,
        faskes_id,
        wpa_faskes(nama, jenis, kota),
        wpa_pks_template(id, nama, judul_kartu, kode, version),
        wpa_pipeline_placeholder_values(placeholder_key, placeholder_value, placeholder_label),
        wpa_users!wpa_pipeline_initiated_by_fkey(full_name, email)
      `)
      .eq('jenis', 'adendum_masal')
      .eq('kantor_cabang_id', me.kantor_cabang_id)

    if (status === 'in_progress') {
      query = query.eq('status', 'in_progress')
    } else if (status === 'completed') {
      query = query.eq('status', 'completed')
    } else if (status === 'rejected') {
      query = query.eq('status', 'rejected')
    }

    if (templateId) query = query.eq('template_id', templateId)

    query = query.order('initiated_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error

    // Group by template_id for CM group review UI
    const grouped: Record<string, {
      template_id: string
      template_nama: string
      template_judul_kartu: string
      template_kode: string
      total_pending: number
      items: any[]
    }> = {}

    for (const p of (data || [])) {
      const tplId = p.template_id
      if (!tplId) continue
      if (!grouped[tplId]) {
        const tpl = p.wpa_pks_template as any
        grouped[tplId] = {
          template_id: tplId,
          template_nama: tpl?.nama || 'Unknown',
          template_judul_kartu: tpl?.judul_kartu || tpl?.nama || 'Unknown',
          template_kode: tpl?.kode || '-',
          total_pending: 0,
          items: [],
        }
      }
      grouped[tplId].items.push(p)
      if (p.status === 'in_progress') grouped[tplId].total_pending++
    }

    return NextResponse.json({
      data: data || [],
      grouped: Object.values(grouped),
    })
  } catch (e: any) {
    console.error('List pending adendum masal error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
