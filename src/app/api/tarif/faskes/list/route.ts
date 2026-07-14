import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const faskes_id = searchParams.get('faskes_id') || me.faskes_id
    const tahun = searchParams.get('tahun') || new Date().getFullYear().toString()
    const status = searchParams.get('status')
    const kategori = searchParams.get('kategori')
    
    if (!faskes_id) {
      return NextResponse.json({ error: 'faskes_id wajib' }, { status: 400 })
    }
    
    let query = supabaseAdmin
      .from('wpa_tarif_faskes')
      .select('*')
      .eq('faskes_id', faskes_id)
      .eq('tahun', parseInt(tahun))
      .order('kategori', { ascending: true })
      .order('nama_item', { ascending: true })
    
    if (status) query = query.eq('status_kewajaran', status)
    if (kategori) query = query.eq('kategori', kategori)
    
    const { data, error } = await query
    if (error) throw error
    
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
