import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2, MapPin, Phone } from 'lucide-react'

export default async function CMFaskesPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: faskesList } = await supabaseAdmin
    .from('wpa_faskes')
    .select('id, nama, jenis, tipe, status, alamat, kota, penanggung_jawab_nama, penanggung_jawab_phone, telp, email')
    .eq('kantor_cabang_id', me.kantor_cabang_id)
    .order('nama')
  
  const aktif = (faskesList || []).filter(f => f.status === 'aktif')
  const pengajuan = (faskesList || []).filter(f => f.status === 'pengajuan')
  const lainnya = (faskesList || []).filter(f => f.status !== 'aktif' && f.status !== 'pengajuan')
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Faskes Mitra</h1>
        <p className="text-sm text-slate-600">Daftar faskes di kantor cabang Anda ({aktif.length} aktif, {pengajuan.length} pengajuan).</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-700">{aktif.length}</div><div className="text-xs text-slate-500">Faskes Aktif</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-yellow-700">{pengajuan.length}</div><div className="text-xs text-slate-500">Dalam Pengajuan</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-slate-700">{lainnya.length}</div><div className="text-xs text-slate-500">Lainnya</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-slate-900">{faskesList?.length || 0}</div><div className="text-xs text-slate-500">Total</div></CardContent></Card>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Faskes</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Kota</TableHead>
                <TableHead>Penanggung Jawab</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(faskesList || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Belum ada faskes terdaftar</TableCell></TableRow>
              ) : faskesList?.map(f => (
                <TableRow key={f.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-700" />
                      <div>
                        <div className="font-medium text-sm">{f.nama}</div>
                        {f.alamat && <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{f.alamat}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{f.jenis}</Badge></TableCell>
                  <TableCell>{f.tipe && f.tipe !== '-' ? <Badge variant="outline">Tipe {f.tipe}</Badge> : '-'}</TableCell>
                  <TableCell className="text-xs">{f.kota || '-'}</TableCell>
                  <TableCell className="text-xs">
                    {f.penanggung_jawab_nama || '-'}
                    {f.penanggung_jawab_phone && <div className="text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{f.penanggung_jawab_phone}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge className={f.status === 'aktif' ? 'bg-green-100 text-green-800' : f.status === 'pengajuan' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'}>
                      {f.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
