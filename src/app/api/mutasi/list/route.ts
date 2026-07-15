import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'

// GET: list mutasi (filter by user_id, kantor, status)
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const status = searchParams.get('status')
    const kantor_cabang_id = searchParams.get('kantor_cabang_id')
    
    let query = supabaseAdmin
      .from('wpa_user_mutasi')
      .select(`
        *,
        from_kantor:wpa_kantor_cabang!wpa_user_mutasi_from_kantor_cabang_id_fkey(nama, kode),
        to_kantor:wpa_kantor_cabang!wpa_user_mutasi_to_kantor_cabang_id_fkey(nama, kode)
      `)
      .order('tanggal_efektif', { ascending: false })
    
    if (user_id) query = query.eq('user_id', user_id)
    if (status) query = query.eq('status', status)
    
    // admin_kantor hanya lihat mutasi yang melibatkan cabangnya
    if ((me.role as string) === 'admin_kantor' && me.kantor_cabang_id) {
      query = query.or(`from_kantor_cabang_id.eq.${me.kantor_cabang_id},to_kantor_cabang_id.eq.${me.kantor_cabang_id}`)
    }
    
    const { data, error } = await query
    if (error) throw error
    
    // Fetch user info separately (avoid PostgREST ambiguous FK)
    const userIds = (data || []).map(m => m.user_id).filter(Boolean)
    let userMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('wpa_users')
        .select('id, email, full_name, role, nip')
        .in('id', [...new Set(userIds)])
      userMap = (users || []).reduce((acc, u) => {
        acc[u.id] = u
        return acc
      }, {} as Record<string, any>)
    }
    
    const enriched = (data || []).map(m => ({
      ...m,
      user: userMap[m.user_id] || null,
    }))
    
    return NextResponse.json({ data: enriched })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
