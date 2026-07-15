import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Inbox, AlertCircle } from 'lucide-react'

export default async function SuperAdminPengajuanPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: pipelines } = await supabaseAdmin
    .from('wpa_pipeline')
    .select('id, jenis, current_tahap, status, sla_deadline, sla_breached, initiated_at, wpa_faskes(nama, kota), wpa_kantor_cabang(nama, kode)')
    .in('status', ['in_progress', 'stalled'])
    .order('updated_at', { ascending: false })
    .limit(200)
  
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Pengajuan</h1><p className="text-sm text-slate-600">Monitoring semua pipeline pengajuan lintas cabang ({pipelines?.length || 0} in-progress).</p></div>
      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow>
          <TableHead>Faskes</TableHead><TableHead>Kantor Cabang</TableHead><TableHead>Jenis</TableHead>
          <TableHead>Tahap</TableHead><TableHead>SLA</TableHead><TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(pipelines || []).length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />Tidak ada pengajuan in-progress
            </TableCell></TableRow>
          ) : pipelines?.map(p => {
            const daysLeft = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / 86400000) : null
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-sm">{(p.wpa_faskes as any)?.nama || '-'}</TableCell>
                <TableCell className="text-xs">{(p.wpa_kantor_cabang as any)?.nama || '-'}</TableCell>
                <TableCell><Badge variant="outline">{p.jenis.replace(/_/g, ' ')}</Badge></TableCell>
                <TableCell className="text-xs">{p.current_tahap.replace(/_/g, ' ')}</TableCell>
                <TableCell><span className={p.sla_breached || (daysLeft !== null && daysLeft < 0) ? 'text-red-700 font-semibold text-xs' : 'text-xs text-slate-500'}>{daysLeft !== null ? `${daysLeft}h` : '-'}</span></TableCell>
                <TableCell><Badge className={p.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}>{p.status}</Badge></TableCell>
              </TableRow>
            )
          })}
        </TableBody></Table>
      </CardContent></Card>
    </div>
  )
}
