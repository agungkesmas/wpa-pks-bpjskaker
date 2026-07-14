import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const kantor_cabang_id = searchParams.get('kantor_cabang_id') || me.kantor_cabang_id
    const kategori = searchParams.get('kategori')
    const tahun = searchParams.get('tahun') || new Date().getFullYear().toString()
    
    if (!kantor_cabang_id) {
      return NextResponse.json({ error: 'kantor_cabang_id wajib' }, { status: 400 })
    }
    
    let query = supabaseAdmin
      .from('wpa_tarif_acuan')
      .select('*')
      .eq('kantor_cabang_id', kantor_cabang_id)
      .eq('tahun', parseInt(tahun))
      .eq('is_active', true)
      .order('kategori', { ascending: true })
      .order('nama_item', { ascending: true })
    
    if (kategori) {
      query = query.eq('kategori', kategori)
    }
    
    const { data, error } = await query
    if (error) throw error
    
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('List acuan error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
