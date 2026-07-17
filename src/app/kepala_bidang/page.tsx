import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ShieldCheck, FileSignature, Briefcase, BarChart3, AlertCircle,
  Clock, ArrowRight, Calendar, ChevronRight, CheckCircle2, Eye, Zap
} from 'lucide-react'
import { TAHAP_LABELS, JENIS_PENGAJUAN_SHORT } from '@/lib/wpa-constants'

function formatDeadline(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (diff < 0) return `Lewat ${Math.abs(days)}h`
  return `${days}h lagi`
}

export default async function KabidDashboard() {
  const me = await getSession()
  if (!me) return null

  const [approvalQueue, tugasCabang, pksAktif, pksBerakhir] = await Promise.all([
    supabaseAdmin.from('wpa_pipeline')
      .select(`id, jenis, current_tahap, sla_deadline, sla_breached,
        wpa_faskes(nama), wpa_users!wpa_pipeline_initiated_by_fkey(full_name)`)
      .eq('current_tahap', 'approval_kabid')
      .eq('status', 'in_progress')
      .eq('kantor_cabang_id', me.kantor_cabang_id),
    supabaseAdmin.from('wpa_pipeline')
      .select('id, jenis, current_tahap, current_handler_id, sla_deadline, sla_breached, wpa_faskes(nama)')
      .eq('kantor_cabang_id', me.kantor_cabang_id)
      .eq('status', 'in_progress')
      .order('sla_deadline', { ascending: true }),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, tanggal_berakhir, faskes_id, wpa_faskes(nama)')
      .eq('kantor_cabang_id', me.kantor_cabang_id)
      .eq('status', 'ditandatangani')
      .gte('tanggal_berakhir', new Date().toISOString().split('T')[0])
      .lte('tanggal_berakhir', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0])
      .order('tanggal_berakhir', { ascending: true }),
  ])

  const pksIds = (pksBerakhir.data || []).map(p => p.id)
  let perpanjanganInProgress: Record<string, boolean> = {}
  if (pksIds.length > 0) {
    const { data: pipelines } = await supabaseAdmin
      .from('wpa_pipeline').select('pks_id')
      .eq('jenis', 'perpanjangan').eq('status', 'in_progress').in('pks_id', pksIds)
    ;(pipelines || []).forEach(p => { perpanjanganInProgress[p.pks_id] = true })
  }

  const stats = [
    { label: 'Butuh Approval', value: approvalQueue.data?.length || 0, icon: ShieldCheck, color: 'bg-teal-700', href: '/kepala_bidang/tugas' },
    { label: 'Tugas Cabang', value: tugasCabang.data?.length || 0, icon: Briefcase, color: 'bg-blue-700', href: '/kepala_bidang/tugas' },
    { label: 'PKS Aktif', value: pksAktif.count || 0, icon: FileSignature, color: 'bg-green-700', href: '/kepala_bidang/dokumen' },
    { label: 'PKS Berakhir', value: pksBerakhir.data?.length || 0, icon: Calendar, color: 'bg-orange-700', href: '/kepala_bidang/dokumen' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Halo {me.full_name}. Berikut approval & tugas di cabang Anda.</p>
      </div>

      {/* Stats clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <Link href="/kepala_bidang/tugas"><Button variant="outline"><Briefcase className="w-4 h-4 mr-2" /> Tugas Cabang</Button></Link>
        <Link href="/kepala_bidang/laporan"><Button variant="outline"><BarChart3 className="w-4 h-4 mr-2" /> Laporan</Button></Link>
        <Link href="/kepala_bidang/settings"><Button variant="outline">Settings</Button></Link>
      </div>

      {/* Antrean Approval — inline action */}
      <Card className={approvalQueue.data?.length ? 'border-teal-300' : ''}>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-teal-700">
            <ShieldCheck className="w-4 h-4" /> Antrean Approval ({approvalQueue.data?.length || 0})
          </CardTitle>
          <Link href="/kepala_bidang/tugas" className="text-xs text-teal-700 hover:underline">Lihat semua <ArrowRight className="w-3 h-3 inline" /></Link>
        </CardHeader>
        <CardContent>
          {approvalQueue.data && approvalQueue.data.length > 0 ? (
            <div className="space-y-2">
              {approvalQueue.data.slice(0, 5).map(p => {
                const picName = (p.wpa_users as any)?.full_name
                const deadline = p.sla_deadline ? formatDeadline(p.sla_deadline) : null
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded border ${p.sla_breached ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm truncate">{(p.wpa_faskes as any)?.nama || 'Faskes'}</span>
                        <Badge variant="outline" className="text-[10px]">{JENIS_PENGAJUAN_SHORT[p.jenis] || p.jenis}</Badge>
                        {picName && <span className="text-[10px] text-slate-400">· {picName}</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> {deadline}
                        {p.sla_breached && <span className="text-red-700 font-semibold">· SLA Lewat</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2 flex gap-1">
                      <Link href={`/kepala_bidang/tugas/detail?id=${p.id}`}>
                        <Button size="sm" className="bg-teal-700 hover:bg-teal-800 h-7 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Tinjau & Approve
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">Tidak ada antrean approval</p>
          )}
        </CardContent>
      </Card>

      {/* PKS Berakhir */}
      {pksBerakhir.data && pksBerakhir.data.length > 0 && (
        <Card className="border-orange-300">
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <Calendar className="w-4 h-4" /> PKS Akan Berakhir (≤90 hari) — {pksBerakhir.data.length}
            </CardTitle>
            <Link href="/kepala_bidang/dokumen" className="text-xs text-orange-700 hover:underline">Lihat semua <ArrowRight className="w-3 h-3 inline" /></Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pksBerakhir.data.slice(0, 5).map(p => {
                const daysLeft = Math.ceil((new Date(p.tanggal_berakhir).getTime() - Date.now()) / 86400000)
                const inProgress = perpanjanganInProgress[p.id]
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{(p.wpa_faskes as any)?.nama || 'Faskes'}</div>
                      <div className="text-xs text-slate-500">{p.kode_pks_pihak_pertama} · {new Date(p.tanggal_berakhir).toLocaleDateString('id-ID')}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={daysLeft < 14 ? 'bg-red-100 text-red-800' : daysLeft < 30 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}>
                        {daysLeft}h
                      </Badge>
                      {inProgress ? <Badge className="bg-blue-100 text-blue-800 text-[10px]">🔄 Proses</Badge> : <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">⚠ Belum</Badge>}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
