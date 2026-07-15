import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    let faskesId = me.faskes_id
    if (!faskesId) {
      const { data: uf } = await supabaseAdmin
        .from('wpa_user_faskes')
        .select('faskes_id')
        .eq('user_id', me.id)
        .limit(1)
      faskesId = uf?.[0]?.faskes_id
    }
    
    if (!faskesId) return NextResponse.json({ data: [] })
    
    const { data, error } = await supabaseAdmin
      .from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, tanggal_mulai, tanggal_berakhir, status')
      .eq('faskes_id', faskesId)
      .eq('status', 'ditandatangani')
      .order('tanggal_berakhir', { ascending: false })
    
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
