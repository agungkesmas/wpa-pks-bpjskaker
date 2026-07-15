import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileSignature, AlertCircle } from 'lucide-react'

export default async function KabidDokumenPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: pksList } = await supabaseAdmin
    .from('wpa_pks')
    .select('id, kode_pks_pihak_pertama, jenis, status, tanggal_mulai, tanggal_berakhir, signed_at, wpa_faskes(nama, jenis, kota)')
    .eq('kantor_cabang_id', me.kantor_cabang_id)
    .in('status', ['ditandatangani', 'berakhir', 'diakhiri'])
    .order('signed_at', { ascending: false })
  
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Dokumen Legal</h1><p className="text-sm text-slate-600">Arsip PKS & Adendum yang sudah ditandatangani.</p></div>
      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow>
          <TableHead>Faskes</TableHead><TableHead>Nomor PKS</TableHead><TableHead>Jenis</TableHead>
          <TableHead>Masa Berlaku</TableHead><TableHead>Status</TableHead><TableHead>Tanggal Sign</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(pksList || []).length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">
              <FileSignature className="w-8 h-8 text-slate-300 mx-auto mb-2" />Belum ada dokumen ditandatangani
            </TableCell></TableRow>
          ) : pksList?.map(p => (
            <TableRow key={p.id}>
              <TableCell className="text-sm font-medium">{p.wpa_faskes?.nama || '-'}</TableCell>
              <TableCell className="font-mono text-xs">{p.kode_pks_pihak_pertama || '-'}</TableCell>
              <TableCell><Badge variant="outline">{p.jenis.replace(/_/g, ' ')}</Badge></TableCell>
              <TableCell className="text-xs">{p.tanggal_mulai ? new Date(p.tanggal_mulai).toLocaleDateString('id-ID') : '-'} s/d {p.tanggal_berakhir ? new Date(p.tanggal_berakhir).toLocaleDateString('id-ID') : '-'}</TableCell>
              <TableCell><Badge className={p.status === 'ditandatangani' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>{p.status}</Badge></TableCell>
              <TableCell className="text-xs text-slate-500">{p.signed_at ? new Date(p.signed_at).toLocaleDateString('id-ID') : '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
      </CardContent></Card>
    </div>
  )
}
