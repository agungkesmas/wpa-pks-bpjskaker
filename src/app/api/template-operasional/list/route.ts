import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const jenis = searchParams.get('jenis')
    
    // Get template cabang + template nasional
    let query = supabaseAdmin
      .from('wpa_template_operasional')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    // Filter: cabang sendiri ATAU nasional
    if (me.kantor_cabang_id && me.role !== 'super_admin') {
      query = query.or(`kantor_cabang_id.eq.${me.kantor_cabang_id},is_national.eq.true`)
    }
    
    if (jenis) query = query.eq('jenis', jenis)
    
    const { data, error } = await query
    if (error) throw error
    
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
