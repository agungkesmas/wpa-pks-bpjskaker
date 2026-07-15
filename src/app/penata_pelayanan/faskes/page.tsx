import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2 } from 'lucide-react'

export default async function PPFaskesPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: faskesList } = await supabaseAdmin
    .from('wpa_faskes')
    .select('id, nama, jenis, tipe, status, kota, penanggung_jawab_nama')
    .eq('kantor_cabang_id', me.kantor_cabang_id)
    .order('nama')
  
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Faskes Mitra</h1><p className="text-sm text-slate-600">Daftar faskes di kantor cabang Anda.</p></div>
      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow>
          <TableHead>Nama Faskes</TableHead><TableHead>Jenis</TableHead><TableHead>Kota</TableHead><TableHead>PJ</TableHead><TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(faskesList || []).length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Belum ada faskes</TableCell></TableRow>
          ) : faskesList?.map(f => (
            <TableRow key={f.id}>
              <TableCell><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-cyan-600" /><span className="font-medium text-sm">{f.nama}</span></div></TableCell>
              <TableCell><Badge variant="outline">{f.jenis}</Badge></TableCell>
              <TableCell className="text-xs">{f.kota || '-'}</TableCell>
              <TableCell className="text-xs">{f.penanggung_jawab_nama || '-'}</TableCell>
              <TableCell><Badge className={f.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>{f.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
      </CardContent></Card>
    </div>
  )
}
