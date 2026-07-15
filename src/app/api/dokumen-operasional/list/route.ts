import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const jenis = searchParams.get('jenis')
    const drafted_by_me = searchParams.get('drafted_by_me') === 'true'
    const review_for_me = searchParams.get('review_for_me') === 'true'
    
    let query = supabaseAdmin
      .from('wpa_dokumen_operasional')
      .select(`
        *,
        wpa_faskes(nama, jenis, kota),
        drafter:wpa_users!wpa_dokumen_operasional_drafted_by_fkey(full_name, role),
        reviewer:wpa_users!wpa_dokumen_operasional_reviewed_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
    
    // Filter by role
    if (me.role === 'penata_pelayanan') {
      if (drafted_by_me) {
        query = query.eq('drafted_by', me.id)
      } else {
        query = query.eq('drafted_by', me.id)
      }
    } else if (me.role === 'case_manager') {
      if (review_for_me) {
        query = query.eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'review_cm')
      } else if (drafted_by_me) {
        query = query.eq('drafted_by', me.id)
      } else {
        query = query.eq('kantor_cabang_id', me.kantor_cabang_id)
      }
    } else if (me.role === 'kepala_bidang') {
      query = query.eq('kantor_cabang_id', me.kantor_cabang_id)
      if (review_for_me) {
        query = query.in('jenis', ['sp3']).in('status', ['review_cm'])
      }
    } else if (me.role === 'super_admin') {
      // All
    }
    
    if (status) query = query.eq('status', status)
    if (jenis) query = query.eq('jenis', jenis)
    
    const { data, error } = await query.limit(100)
    if (error) throw error
    
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
