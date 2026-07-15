import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileSignature, AlertCircle } from 'lucide-react'

export default async function PicRsDokumenPage() {
  const me = await getSession()
  if (!me || !me.faskes_id) return null
  
  const { data: pksList } = await supabaseAdmin
    .from('wpa_pks')
    .select('id, kode_pks_pihak_pertama, kode_pks_pihak_kedua, jenis, status, tanggal_mulai, tanggal_berakhir, tanggal_tanda_tangan, signed_at')
    .eq('faskes_id', me.faskes_id)
    .order('created_at', { ascending: false })
  
  const aktif = (pksList || []).filter(p => p.status === 'ditandatangani')
  const draft = (pksList || []).filter(p => p.status !== 'ditandatangani' && p.status !== 'berakhir' && p.status !== 'diakhiri')
  const riwayat = (pksList || []).filter(p => p.status === 'berakhir' || p.status === 'diakhiri')
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dokumen Saya</h1>
        <p className="text-sm text-slate-600">PKS & Adendum untuk faskes Anda.</p>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-700">{aktif.length}</div><div className="text-xs text-slate-500">PKS Aktif</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-yellow-700">{draft.length}</div><div className="text-xs text-slate-500">Sedang Diproses</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-slate-500">{riwayat.length}</div><div className="text-xs text-slate-500">Riwayat</div></CardContent></Card>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor PKS (Pihak 1)</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Masa Berlaku</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal Tanda Tangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pksList || []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  Belum ada dokumen PKS untuk faskes Anda
                </TableCell></TableRow>
              ) : pksList?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.kode_pks_pihak_pertama || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{p.jenis.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {p.tanggal_mulai ? new Date(p.tanggal_mulai).toLocaleDateString('id-ID') : '-'} s/d {p.tanggal_berakhir ? new Date(p.tanggal_berakhir).toLocaleDateString('id-ID') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={p.status === 'ditandatangani' ? 'bg-green-100 text-green-800' : p.status === 'berakhir' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {p.signed_at ? new Date(p.signed_at).toLocaleDateString('id-ID') : '-'}
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
