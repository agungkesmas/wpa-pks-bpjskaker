import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Briefcase, Inbox, Building2, AlertCircle, Clock, ArrowRight,
  FileText, UserPlus, Calendar, ScanLine, Hand, Eye, CheckCircle2,
  ChevronRight, Zap
} from 'lucide-react'
import { TAHAP_LABELS, JENIS_PENGAJUAN_SHORT } from '@/lib/wpa-constants'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d}h lalu`
  if (h > 0) return `${h}j lalu`
  return 'baru saja'
}

function formatDeadline(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  const hours = Math.ceil(diff / 3600000)
  if (diff < 0) return `Lewat ${Math.abs(days)}h`
  if (hours < 24) return `${hours} jam lagi`
  return `${days} hari lagi`
}

// Context-aware action button per tahap
function TahapActionButton({ pipelineId, tahap, role }: { pipelineId: string; tahap: string; role: string }) {
  const detailHref = `/${role}/tugas/detail?id=${pipelineId}`

  if (tahap === 'ditinjau_kajian_tarif') {
    return (
      <div className="flex gap-1">
        <Link href={`${detailHref}&action=scan`}>
          <Button size="sm" className="bg-blue-700 hover:bg-blue-800 h-7 text-xs">
            <ScanLine className="w-3 h-3 mr-1" /> Scan Tarif
          </Button>
        </Link>
        <Link href={detailHref}>
          <Button size="sm" variant="outline" className="h-7 text-xs"><Eye className="w-3 h-3 mr-1" /> Lihat</Button>
        </Link>
      </div>
    )
  }
  if (tahap === 'drafting_pks' || tahap === 'drafting_adendum') {
    return (
      <div className="flex gap-1">
        <Link href={detailHref}>
          <Button size="sm" className="bg-purple-700 hover:bg-purple-800 h-7 text-xs">
            <FileText className="w-3 h-3 mr-1" /> Review Draft
          </Button>
        </Link>
      </div>
    )
  }
  if (tahap === 'kredensialing') {
    return (
      <Link href={detailHref}>
        <Button size="sm" className="bg-teal-700 hover:bg-teal-800 h-7 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Kredensialing
        </Button>
      </Link>
    )
  }
  if (tahap === 'approval_kabid') {
    return (
      <Link href={detailHref}>
        <Button size="sm" className="bg-teal-700 hover:bg-teal-800 h-7 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
        </Button>
      </Link>
    )
  }
  if (tahap === 'review_legal_rs') {
    return (
      <Link href={detailHref}>
        <Button size="sm" className="bg-purple-700 hover:bg-purple-800 h-7 text-xs">
          <FileText className="w-3 h-3 mr-1" /> Review Legal
        </Button>
      </Link>
    )
  }
  if (tahap === 'tanda_tangan') {
    return (
      <Link href={detailHref}>
        <Button size="sm" className="bg-green-700 hover:bg-green-800 h-7 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Tanda Tangan
        </Button>
      </Link>
    )
  }
  // Default: Lanjutkan
  return (
    <Link href={detailHref}>
      <Button size="sm" variant="default" className="h-7 text-xs">Lanjutkan <ChevronRight className="w-3 h-3" /></Button>
    </Link>
  )
}

export default async function CMDashboard() {
  const me = await getSession()
  if (!me) return null

  const [allTugas, faskesAktif, pksBerakhir] = await Promise.all([
    supabaseAdmin.from('wpa_pipeline')
      .select(`
        id, jenis, current_tahap, sla_deadline, sla_breached, faskes_id,
        current_handler_id, initiated_at, updated_at,
        wpa_faskes(nama, jenis, kota),
        wpa_users!wpa_pipeline_initiated_by_fkey(full_name)
      `)
      .eq('kantor_cabang_id', me.kantor_cabang_id)
      .eq('status', 'in_progress')
      .order('sla_deadline', { ascending: true }),
    supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'aktif'),
    supabaseAdmin.from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, tanggal_berakhir, faskes_id, wpa_faskes(nama)')
      .eq('kantor_cabang_id', me.kantor_cabang_id)
      .eq('status', 'ditandatangani')
      .gte('tanggal_berakhir', new Date().toISOString().split('T')[0])
      .lte('tanggal_berakhir', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0])
      .order('tanggal_berakhir', { ascending: true }),
  ])

  const myTasks = (allTugas.data || []).filter(t => t.current_handler_id === me.id)
  const unclaimedTasks = (allTugas.data || []).filter(t => t.current_handler_id === null)
  const slaBreachedTasks = (allTugas.data || []).filter(t => t.sla_breached)

  // Check perpanjangan in-progress
  const pksIds = (pksBerakhir.data || []).map(p => p.id)
  let perpanjanganInProgress: Record<string, boolean> = {}
  if (pksIds.length > 0) {
    const { data: pipelines } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('pks_id')
      .eq('jenis', 'perpanjangan')
      .eq('status', 'in_progress')
      .in('pks_id', pksIds)
    ;(pipelines || []).forEach(p => { perpanjanganInProgress[p.pks_id] = true })
  }

  // Stats array dengan link
  const stats = [
    { label: 'Saya Pegang', value: myTasks.length, icon: Briefcase, color: 'bg-blue-700', href: '/case_manager/tugas' },
    { label: 'Belum Diambil', value: unclaimedTasks.length, icon: Inbox, color: 'bg-yellow-600', href: '/case_manager/tugas' },
    { label: 'Faskes Mitra', value: faskesAktif.count || 0, icon: Building2, color: 'bg-orange-700', href: '/case_manager/faskes' },
    { label: 'SLA Lewat', value: slaBreachedTasks.length, icon: AlertCircle, color: 'bg-red-700', href: '/case_manager/tugas' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Halo {me.full_name}. Berikut tugas & aksi Anda hari ini.</p>
      </div>

      {/* Stats — clickable */}
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
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    {s.label} <ChevronRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Action */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/case_manager/pks-baru">
          <Button className="bg-blue-700 hover:bg-blue-800"><UserPlus className="w-4 h-4 mr-2" /> Create User PIC RS</Button>
        </Link>
        <Link href="/case_manager/faskes">
          <Button variant="outline"><Building2 className="w-4 h-4 mr-2" /> Faskes Mitra</Button>
        </Link>
        <Link href="/case_manager/tarif">
          <Button variant="outline">Bank Tarif</Button>
        </Link>
      </div>

      {/* AKSI HARI INI — context-aware action buttons */}
      <Card>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-600" /> Aksi Hari Ini
          </CardTitle>
          <Link href="/case_manager/tugas" className="text-xs text-blue-700 hover:underline">
            Lihat semua <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </CardHeader>
        <CardContent>
          {(allTugas.data || []).length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Tidak ada tugas in-progress</p>
          ) : (
            <div className="space-y-2">
              {(allTugas.data || []).slice(0, 8).map(p => {
                const isMine = p.current_handler_id === me.id
                const isUnclaimed = p.current_handler_id === null
                const picName = (p.wpa_users as any)?.full_name
                const deadline = p.sla_deadline ? formatDeadline(p.sla_deadline) : null
                const isOverdue = p.sla_breached

                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded border ${isOverdue ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm truncate">{(p.wpa_faskes as any)?.nama || 'Faskes'}</span>
                        <Badge variant="outline" className="text-[10px]">{JENIS_PENGAJUAN_SHORT[p.jenis] || p.jenis}</Badge>
                        {isMine && <Badge className="bg-blue-100 text-blue-800 text-[9px]">Saya Pegang</Badge>}
                        {isUnclaimed && <Badge className="bg-yellow-100 text-yellow-800 text-[9px]">Belum Diambil</Badge>}
                        {picName && <span className="text-[10px] text-slate-400">· {picName}</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {TAHAP_LABELS[p.current_tahap] || p.current_tahap}</span>
                        {deadline && <span className={isOverdue ? 'text-red-700 font-semibold' : ''}>· {deadline}</span>}
                        <span className="text-slate-400">· {timeAgo(p.initiated_at)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {isUnclaimed ? (
                        <Link href={`/${me.role}/tugas/detail?id=${p.id}`}>
                          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 h-7 text-xs">
                            <Hand className="w-3 h-3 mr-1" /> Ambil Alih
                          </Button>
                        </Link>
                      ) : isMine ? (
                        <TahapActionButton pipelineId={p.id} tahap={p.current_tahap} role={me.role} />
                      ) : (
                        <Link href={`/${me.role}/tugas/detail?id=${p.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs"><Eye className="w-3 h-3 mr-1" /> Lihat</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Faskes Akan Perpanjang — dengan tombol action */}
      {pksBerakhir.data && pksBerakhir.data.length > 0 && (
        <Card className="border-orange-300">
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <Calendar className="w-4 h-4" /> Faskes Akan Perpanjang (≤90 hari) — {pksBerakhir.data.length}
            </CardTitle>
            <Link href="/case_manager/faskes" className="text-xs text-orange-700 hover:underline">
              Lihat semua <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pksBerakhir.data.slice(0, 6).map(p => {
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
                        {daysLeft}h lagi
                      </Badge>
                      {inProgress ? (
                        <Badge className="bg-blue-100 text-blue-800 text-[10px]">🔄 Dalam Proses</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">⚠ Belum diajukan</Badge>
                      )}
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
