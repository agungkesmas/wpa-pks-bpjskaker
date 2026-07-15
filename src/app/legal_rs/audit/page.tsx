import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListChecks } from 'lucide-react'

export default async function LegalRsAuditPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: logs } = await supabaseAdmin
    .from('wpa_audit_logs')
    .select('id, action, entity_type, entity_id, created_at, ip')
    .eq('user_id', me.id)
    .order('created_at', { ascending: false })
    .limit(100)
  
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Audit Log</h1><p className="text-sm text-slate-600">Riwayat aktivitas Anda (100 entri terakhir).</p></div>
      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow>
          <TableHead>Waktu</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>IP</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(logs || []).length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8">
              <ListChecks className="w-8 h-8 text-slate-300 mx-auto mb-2" />Belum ada aktivitas tercatat
            </TableCell></TableRow>
          ) : logs?.map(l => (
            <TableRow key={l.id}>
              <TableCell className="text-xs text-slate-500">{new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
              <TableCell><Badge variant="outline" className="font-mono text-xs">{l.action}</Badge></TableCell>
              <TableCell className="text-xs">{l.entity_type || '-'}{l.entity_id ? ` / ${l.entity_id.substring(0,8)}` : ''}</TableCell>
              <TableCell className="text-xs font-mono">{l.ip || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
      </CardContent></Card>
    </div>
  )
}
