import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// Comparison dashboard: aggregate status per faskes, atau detail per faskes
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const faskes_id = searchParams.get('faskes_id') || me.faskes_id
    const kantor_cabang_id = searchParams.get('kantor_cabang_id') || me.kantor_cabang_id
    const tahun = searchParams.get('tahun') || new Date().getFullYear().toString()
    
    if (faskes_id) {
      // Detail per faskes: summary + items by status
      const { data: items } = await supabaseAdmin
        .from('wpa_tarif_faskes')
        .select('id, kategori, nama_item, satuan, tarif, tarif_acuan, selisih, selisih_percent, z_score, status_kewajaran')
        .eq('faskes_id', faskes_id)
        .eq('tahun', parseInt(tahun))
        .order('kategori')
        .order('nama_item')
      
      const summary = {
        total: items?.length || 0,
        wajar: items?.filter(i => i.status_kewajaran === 'wajar').length || 0,
        perlu_review: items?.filter(i => i.status_kewajaran === 'perlu_review').length || 0,
        tinggi: items?.filter(i => i.status_kewajaran === 'tinggi').length || 0,
        rendah: items?.filter(i => i.status_kewajaran === 'rendah').length || 0,
        ekstrem: items?.filter(i => i.status_kewajaran === 'ekstrem').length || 0,
        no_acuan: items?.filter(i => i.status_kewajaran === 'no_acuan').length || 0,
      }
      
      return NextResponse.json({ 
        faskes_id, 
        tahun: parseInt(tahun),
        summary, 
        items: items || [] 
      })
    }
    
    if (kantor_cabang_id) {
      // Summary per faskes dalam kantor cabang
      const { data: faskesList } = await supabaseAdmin
        .from('wpa_faskes')
        .select('id, nama, jenis, status')
        .eq('kantor_cabang_id', kantor_cabang_id)
        .order('nama')
      
      const result = []
      for (const f of faskesList || []) {
        const { data: items } = await supabaseAdmin
          .from('wpa_tarif_faskes')
          .select('status_kewajaran')
          .eq('faskes_id', f.id)
          .eq('tahun', parseInt(tahun))
        
        const summary = {
          total: items?.length || 0,
          wajar: items?.filter(i => i.status_kewajaran === 'wajar').length || 0,
          perlu_review: items?.filter(i => i.status_kewajaran === 'perlu_review').length || 0,
          tinggi: items?.filter(i => i.status_kewajaran === 'tinggi').length || 0,
          rendah: items?.filter(i => i.status_kewajaran === 'rendah').length || 0,
          ekstrem: items?.filter(i => i.status_kewajaran === 'ekstrem').length || 0,
          no_acuan: items?.filter(i => i.status_kewajaran === 'no_acuan').length || 0,
        }
        result.push({ ...f, tahun: parseInt(tahun), summary })
      }
      
      return NextResponse.json({ 
        kantor_cabang_id, 
        tahun: parseInt(tahun), 
        faskes: result 
      })
    }
    
    return NextResponse.json({ error: 'faskes_id atau kantor_cabang_id wajib' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
