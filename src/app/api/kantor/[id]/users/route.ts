import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'

// GET: list users di kantor tertentu
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    
    // admin_kantor hanya lihat user di cabangnya
    if (me.role === 'admin_kantor' && me.kantor_cabang_id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Get users dengan role BPJS internal di kantor ini
    // (PIC RS & Legal RS tidak terikat kantor_cabang_id langsung, tapi via faskes)
    const { data: users, error } = await supabaseAdmin
      .from('wpa_users')
      .select(`
        id, email, full_name, role, phone, nip, profile_photo_url, is_active, 
        last_login_at, created_at, must_change_password
      `)
      .eq('kantor_cabang_id', id)
      .order('role', { ascending: true })
      .order('full_name', { ascending: true })
    
    if (error) throw error
    
    // Get mutasi pending untuk user-user ini
    const userIds = (users || []).map(u => u.id)
    let mutasiMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: mutasi } = await supabaseAdmin
        .from('wpa_user_mutasi')
        .select('user_id, to_kantor_cabang_id, tanggal_efektif, status, nomor_sk')
        .in('user_id', userIds)
        .eq('status', 'pending')
      mutasiMap = (mutasi || []).reduce((acc, m) => {
        acc[m.user_id] = m
        return acc
      }, {} as Record<string, any>)
    }
    
    const enriched = (users || []).map(u => ({
      ...u,
      mutasi_pending: mutasiMap[u.id] || null,
    }))
    
    return NextResponse.json({ data: enriched })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
