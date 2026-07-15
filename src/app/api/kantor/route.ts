import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'

// GET: list kantor cabang (super_admin = all, admin_kantor = only own)
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const { searchParams } = new URL(req.url)
    const includeStats = searchParams.get('stats') === 'true'
    
    let query = supabaseAdmin
      .from('wpa_kantor_cabang')
      .select('*')
      .order('nama', { ascending: true })
    
    // admin_kantor hanya lihat cabangnya sendiri
    if ((me.role as string) === 'admin_kantor' && me.kantor_cabang_id) {
      query = query.eq('id', me.kantor_cabang_id)
    }
    
    const { data: kantorList, error } = await query
    if (error) throw error
    
    if (!includeStats) {
      return NextResponse.json({ data: kantorList || [] })
    }
    
    // Tambah stats per kantor
    const result: any[] = []
    for (const k of kantorList || []) {
      const [users, faskes, pksAktif] = await Promise.all([
        supabaseAdmin.from('wpa_users').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('is_active', true),
        supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('status', 'aktif'),
        supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('status', 'ditandatangani'),
      ])
      result.push({
        ...k,
        stats: {
          users: users.count || 0,
          faskes: faskes.count || 0,
          pks_aktif: pksAktif.count || 0,
        }
      })
    }
    
    return NextResponse.json({ data: result })
  } catch (e: any) {
    console.error('List kantor error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: create kantor cabang (super_admin only)
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya super_admin yang bisa create kantor cabang' }, { status: 403 })
    }
    
    const body = await req.json()
    const { kode, nama, alamat, kota, provinsi, telp, email, is_active = true } = body
    
    if (!kode || !nama) {
      return NextResponse.json({ error: 'kode dan nama wajib' }, { status: 400 })
    }
    
    const { data, error } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .insert({ kode, nama, alamat, kota, provinsi, telp, email, is_active })
      .select()
      .single()
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Kode kantor sudah ada' }, { status: 400 })
      }
      throw error
    }
    
    await logAudit({
      user_id: me.id,
      action: 'create_kantor',
      entity_type: 'kantor_cabang',
      entity_id: data.id,
      after_data: data,
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
