import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileSignature, AlertCircle, Clock } from 'lucide-react'

export default async function LegalRsReviewPage() {
  const me = await getSession()
  if (!me || !me.faskes_id) return null
  
  const { data: pipelines } = await supabaseAdmin
    .from('wpa_pipeline')
    .select('id, jenis, current_tahap, sla_deadline, sla_breached, wpa_faskes(nama)')
    .eq('faskes_id', me.faskes_id)
    .eq('current_tahap', 'review_legal_rs')
    .eq('status', 'in_progress')
    .order('sla_deadline', { ascending: true })
  
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Review</h1><p className="text-sm text-slate-600">Dokumen yang menunggu review Legal RS Anda ({pipelines?.length || 0} antrean).</p></div>
      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow>
          <TableHead>Faskes</TableHead><TableHead>Jenis</TableHead><TableHead>SLA</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(pipelines || []).length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">
              <FileSignature className="w-8 h-8 text-slate-300 mx-auto mb-2" />Tidak ada dokumen menunggu review
            </TableCell></TableRow>
          ) : pipelines?.map(p => {
            const daysLeft = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / 86400000) : null
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-sm">{(p.wpa_faskes as any)?.nama || '-'}</TableCell>
                <TableCell><Badge variant="outline">{p.jenis.replace(/_/g, ' ')}</Badge></TableCell>
                <TableCell><span className={p.sla_breached || (daysLeft !== null && daysLeft < 0) ? 'text-red-700 font-semibold text-xs' : 'text-xs text-slate-500'}>{daysLeft !== null ? `${daysLeft}h` : '-'}</span></TableCell>
              </TableRow>
            )
          })}
        </TableBody></Table>
      </CardContent></Card>
    </div>
  )
}
