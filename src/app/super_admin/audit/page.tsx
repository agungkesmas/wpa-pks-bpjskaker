import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function AuditPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: logs } = await supabaseAdmin
    .from('wpa_audit_logs')
    .select('id, action, entity_type, entity_id, before_data, after_data, ip, user_agent, created_at, wpa_users(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(200)
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-600">Riwayat semua aktivitas sistem (200 entri terakhir, immutable).</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>User</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs || []).map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{l.action}</Badge></TableCell>
                  <TableCell className="text-xs">{l.entity_type || '-'}{l.entity_id ? ` / ${l.entity_id.substring(0,8)}` : ''}</TableCell>
                  <TableCell className="text-xs">{(l as any).wpa_users?.email || '-'}</TableCell>
                  <TableCell className="text-xs font-mono">{l.ip || '-'}</TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                    {l.after_data ? JSON.stringify(l.after_data).substring(0, 80) : '-'}
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
