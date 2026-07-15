import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const jenis = searchParams.get('jenis')
    const active_only = searchParams.get('active_only') === 'true'
    
    let query = supabaseAdmin
      .from('wpa_pks_template')
      .select('*')
      .order('uploaded_at', { ascending: false })
    
    if (jenis) query = query.eq('jenis_dokumen', jenis)
    if (active_only) query = query.eq('is_active', true)
    
    const { data, error } = await query
    if (error) throw error
    
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
