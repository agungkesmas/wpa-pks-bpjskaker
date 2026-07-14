import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Wallet, TrendingUp, AlertCircle } from 'lucide-react'

const fmtRp = (n: number | null) => n ? `Rp ${n.toLocaleString('id-ID')}` : '-'

export default async function AdminTarifPage() {
  const me = await getSession()
  if (!me) return null
  
  const tahun = new Date().getFullYear()
  
  // Get all acuan for this kantor cabang
  const { data: acuanList } = await supabaseAdmin
    .from('wpa_tarif_acuan')
    .select('*')
    .eq('kantor_cabang_id', me.kantor_cabang_id)
    .eq('tahun', tahun)
    .eq('is_active', true)
    .order('kategori')
    .order('nama_item')
  
  // Get all faskes for this kantor with their tarif summary
  const { data: faskesList } = await supabaseAdmin
    .from('wpa_faskes')
    .select('id, nama, jenis, status')
    .eq('kantor_cabang_id', me.kantor_cabang_id)
    .order('nama')
  
  const faskesSummary = []
  for (const f of faskesList || []) {
    const { data: items } = await supabaseAdmin
      .from('wpa_tarif_faskes')
      .select('status_kewajaran, tarif')
      .eq('faskes_id', f.id)
      .eq('tahun', tahun)
    
    faskesSummary.push({
      ...f,
      total: items?.length || 0,
      wajar: items?.filter(i => i.status_kewajaran === 'wajar').length || 0,
      perlu_review: items?.filter(i => i.status_kewajaran === 'perlu_review').length || 0,
      tinggi: items?.filter(i => i.status_kewajaran === 'tinggi').length || 0,
      rendah: items?.filter(i => i.status_kewajaran === 'rendah').length || 0,
      ekstrem: items?.filter(i => i.status_kewajaran === 'ekstrem').length || 0,
      no_acuan: items?.filter(i => i.status_kewajaran === 'no_acuan').length || 0,
    })
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bank Tarif & Komparasi</h1>
        <p className="text-sm text-slate-600">
          Overview tarif acuan kantor cabang & status kewajaran semua faskes tahun {tahun}.
        </p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <Wallet className="w-5 h-5 text-blue-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{acuanList?.length || 0}</div>
            <div className="text-xs text-slate-500">Total Item Acuan</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <TrendingUp className="w-5 h-5 text-teal-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{faskesSummary.filter(f => f.total > 0).length}</div>
            <div className="text-xs text-slate-500">Faskes Sudah Upload</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <AlertCircle className="w-5 h-5 text-orange-700 mb-1" />
            <div className="text-2xl font-bold text-orange-700">
              {faskesSummary.reduce((s, f) => s + f.perlu_review + f.tinggi + f.rendah + f.ekstrem, 0)}
            </div>
            <div className="text-xs text-slate-500">Item Perlu Perhatian</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <AlertCircle className="w-5 h-5 text-red-700 mb-1" />
            <div className="text-2xl font-bold text-red-700">
              {faskesSummary.reduce((s, f) => s + f.ekstrem, 0)}
            </div>
            <div className="text-xs text-slate-500">Item Ekstrem</div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Kewajaran per Faskes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faskes</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Wajar</TableHead>
                <TableHead className="text-center">Review</TableHead>
                <TableHead className="text-center">Tinggi</TableHead>
                <TableHead className="text-center">Rendah</TableHead>
                <TableHead className="text-center">Ekstrem</TableHead>
                <TableHead className="text-center">No Acuan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faskesSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                    Belum ada faskes terdaftar di kantor cabang ini
                  </TableCell>
                </TableRow>
              ) : faskesSummary.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nama}</TableCell>
                  <TableCell><Badge variant="outline">{f.jenis}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{f.total}</TableCell>
                  <TableCell className="text-center">
                    {f.wajar > 0 ? <Badge className="bg-green-100 text-green-800">{f.wajar}</Badge> : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {f.perlu_review > 0 ? <Badge className="bg-yellow-100 text-yellow-800">{f.perlu_review}</Badge> : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {f.tinggi > 0 ? <Badge className="bg-orange-100 text-orange-800">{f.tinggi}</Badge> : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {f.rendah > 0 ? <Badge className="bg-blue-100 text-blue-800">{f.rendah}</Badge> : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {f.ekstrem > 0 ? <Badge className="bg-red-100 text-red-800">{f.ekstrem}</Badge> : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {f.no_acuan > 0 ? <Badge className="bg-slate-100 text-slate-600">{f.no_acuan}</Badge> : <span className="text-slate-300">-</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Tarif Acuan Kantor Cabang</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {acuanList && acuanList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Nama Item</TableHead>
                  <TableHead className="text-right">Tarif Acuan</TableHead>
                  <TableHead className="text-right">Min/Max</TableHead>
                  <TableHead className="text-center">Sample</TableHead>
                  <TableHead>Sumber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acuanList.map(a => (
                  <TableRow key={a.id}>
                    <TableCell><Badge variant="outline">{a.kategori}</Badge></TableCell>
                    <TableCell className="font-medium">{a.nama_item}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtRp(a.tarif_acuan)}</TableCell>
                    <TableCell className="text-right text-xs text-slate-500">
                      {a.tarif_min ? fmtRp(a.tarif_min) : '-'} / {a.tarif_max ? fmtRp(a.tarif_max) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.sample_count > 0 ? <Badge className="bg-blue-100 text-blue-800">{a.sample_count} RS</Badge> : '-'}
                    </TableCell>
                    <TableCell>
                      {a.sumber === 'calculation' ? (
                        <Badge className="bg-teal-100 text-teal-800">Kalkulasi</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700">Manual</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Wallet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Belum ada tarif acuan. Case Manager dapat input via menu Bank Tarif.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
