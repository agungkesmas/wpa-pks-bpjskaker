import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { TarifAcuanManager } from '@/components/wpa/TarifAcuanManager'

export default async function TarifPage() {
  const me = await getSession()
  if (!me) return null
  
  const kantor_cabang_id = me.kantor_cabang_id
  const tahun = new Date().getFullYear()
  
  const { data: acuanList } = await supabaseAdmin
    .from('wpa_tarif_acuan')
    .select('*')
    .eq('kantor_cabang_id', kantor_cabang_id)
    .eq('tahun', tahun)
    .eq('is_active', true)
    .order('kategori')
    .order('nama_item')
  
  const { data: kantor } = await supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('nama')
    .eq('id', kantor_cabang_id)
    .single()
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bank Tarif Acuan</h1>
        <p className="text-sm text-slate-600">
          Kelola tarif acuan (referensi) untuk <strong>{kantor?.nama || 'kantor cabang'}</strong> tahun {tahun}.
          Dipakai sebagai benchmark saat faskes upload tarif.
        </p>
      </div>
      <TarifAcuanManager 
        acuanList={acuanList || []} 
        kantor_cabang_id={kantor_cabang_id!}
        tahun={tahun}
      />
    </div>
  )
}
