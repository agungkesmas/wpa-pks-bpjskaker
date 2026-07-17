import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  FileSignature, FolderOpen, ListChecks, Clock, ArrowRight,
  ChevronRight, Zap, Eye
} from 'lucide-react'
import { TAHAP_LABELS, JENIS_PENGAJUAN_SHORT } from '@/lib/wpa-constants'

export default async function LegalRSDashboard() {
  const me = await getSession()
  if (!me) return null

  // Review queue: pipelines di tahap review_legal_rs untuk faskes ini
  const { data: reviewQueue } = await supabaseAdmin
    .from('wpa_pipeline')
    .select(`id, jenis, current_tahap, sla_deadline, sla_breached, faskes_id,
      wpa_faskes(nama), wpa_users!wpa_pipeline_initiated_by_fkey(full_name)`)
    .eq('current_tahap', 'review_legal_rs')
    .eq('status', 'in_progress')

  // Filter by faskes yang terkait dengan legal_rs ini
  const { data: userFaskes } = await supabaseAdmin
    .from('wpa_user_faskes').select('faskes_id').eq('user_id', me.id)
  const faskesIds = (userFaskes || []).map(uf => uf.faskes_id)
  const myReviews = (reviewQueue || []).filter(p => faskesIds.includes(p.faskes_id))

  const { count: auditCount } = await supabaseAdmin
    .from('wpa_audit_logs').select('*', { count: 'exact', head: true }).eq('user_id', me.id)

  const stats = [
    { label: 'Menunggu Review', value: myReviews.length, icon: FileSignature, color: 'bg-purple-800', href: '/legal_rs/review' },
    { label: 'Dokumen Legal', value: '-', icon: FolderOpen, color: 'bg-green-700', href: '/legal_rs/dokumen' },
    { label: 'Audit Log', value: auditCount || 0, icon: ListChecks, color: 'bg-slate-700', href: '/legal_rs/audit' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Halo {me.full_name}. Tinjau dokumen legal dari BPJS.</p>
      </div>

      {/* Stats clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href}>
              <Card className="hover:shadow-md hover:border-slate-300 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className={`${s.color} w-8 h-8 rounded-lg flex items-center justify-center mb-2`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">{s.label} <ChevronRight className="w-3 h-3" /></div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Action */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/legal_rs/review"><Button variant="outline"><FileSignature className="w-4 h-4 mr-2" /> Review Dokumen</Button></Link>
        <Link href="/legal_rs/dokumen"><Button variant="outline"><FolderOpen className="w-4 h-4 mr-2" /> Dokumen Legal</Button></Link>
      </div>

      {/* Aksi Hari Ini — Review dengan inline action */}
      <Card className={myReviews.length > 0 ? 'border-purple-300' : ''}>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-purple-700">
            <Zap className="w-4 h-4" /> Dokumen Menunggu Review ({myReviews.length})
          </CardTitle>
          <Link href="/legal_rs/review" className="text-xs text-purple-700 hover:underline">Lihat semua <ArrowRight className="w-3 h-3 inline" /></Link>
        </CardHeader>
        <CardContent>
          {myReviews.length > 0 ? (
            <div className="space-y-2">
              {myReviews.slice(0, 5).map(p => {
                const picName = (p.wpa_users as any)?.full_name
                const daysLeft = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded border ${p.sla_breached ? 'border-red-300 bg-red-50/50' : 'border-purple-200 bg-purple-50/30'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm truncate">{(p.wpa_faskes as any)?.nama || 'Faskes'}</span>
                        <Badge variant="outline" className="text-[10px]">{JENIS_PENGAJUAN_SHORT[p.jenis] || p.jenis}</Badge>
                        {picName && <span className="text-[10px] text-slate-400">· {picName}</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> {TAHAP_LABELS[p.current_tahap] || p.current_tahap}
                        {p.sla_deadline && <span className={p.sla_breached || (daysLeft !== null && daysLeft < 0) ? 'text-red-700 font-semibold' : ''}>· {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}h lagi` : 'lewat'}</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2 flex gap-1">
                      <Link href={`/legal_rs/review?p=${p.id}`}>
                        <Button size="sm" className="bg-purple-700 hover:bg-purple-800 h-7 text-xs">
                          <Eye className="w-3 h-3 mr-1" /> Review Sekarang
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">Tidak ada dokumen menunggu review</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
