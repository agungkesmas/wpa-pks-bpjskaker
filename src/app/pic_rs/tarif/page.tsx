import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { UploadTarifFaskes } from '@/components/wpa/UploadTarifFaskes'

export default async function UploadTarifPage() {
  const me = await getSession()
  if (!me || !me.faskes_id) return null
  
  const tahun = new Date().getFullYear()
  
  const { data: existingItems } = await supabaseAdmin
    .from('wpa_tarif_faskes')
    .select('*')
    .eq('faskes_id', me.faskes_id)
    .eq('tahun', tahun)
    .order('kategori')
    .order('nama_item')
  
  const { data: faskes } = await supabaseAdmin
    .from('wpa_faskes')
    .select('nama, jenis')
    .eq('id', me.faskes_id)
    .single()
  
  const { data: batches } = await supabaseAdmin
    .from('wpa_tarif_upload_batch')
    .select('*')
    .eq('faskes_id', me.faskes_id)
    .order('created_at', { ascending: false })
    .limit(10)
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Tarif Faskes</h1>
        <p className="text-sm text-slate-600">
          Upload tarif untuk <strong>{faskes?.nama}</strong> ({faskes?.jenis}) tahun {tahun}.
          Sistem akan otomatis membandingkan dengan tarif acuan kantor cabang.
        </p>
      </div>
      <UploadTarifFaskes 
        faskes_id={me.faskes_id}
        faskes_nama={faskes?.nama || ''}
        tahun={tahun}
        existingItems={existingItems || []}
        batches={batches || []}
      />
    </div>
  )
}
