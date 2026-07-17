import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Briefcase, Inbox, Building2, Clock, ArrowRight, Hand, Eye,
  ChevronRight, Zap, FileText
} from 'lucide-react'
import { TAHAP_LABELS, JENIS_PENGAJUAN_SHORT } from '@/lib/wpa-constants'

export default async function PPDashboard() {
  const me = await getSession()
  if (!me) return null

  const [allTugas, faskesAktif] = await Promise.all([
    supabaseAdmin.from('wpa_pipeline')
      .select('id, jenis, current_tahap, sla_deadline, current_handler_id, takeover_enabled, sla_breached, wpa_faskes(nama)')
      .eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'in_progress')
      .order('sla_deadline', { ascending: true }),
    supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'aktif'),
  ])

  const myTasks = (allTugas.data || []).filter(t => t.current_handler_id === me.id)
  const ppAvailable = (allTugas.data || []).filter(t => t.takeover_enabled && t.current_handler_id !== me.id)

  const stats = [
    { label: 'Saya Pegang', value: myTasks.length, icon: Briefcase, color: 'bg-cyan-600', href: '/penata_pelayanan/tugas' },
    { label: 'PP Bisa Ambil', value: ppAvailable.length, icon: Inbox, color: 'bg-yellow-600', href: '/penata_pelayanan/tugas' },
    { label: 'Faskes Mitra', value: faskesAktif.count || 0, icon: Building2, color: 'bg-orange-700', href: '/penata_pelayanan/faskes' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Halo {me.full_name}. Bantu CM mengerjakan tugas — klik "Ambil Alih" kalau CM berhalangan.</p>
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
        <Link href="/penata_pelayanan/tugas"><Button variant="outline"><Briefcase className="w-4 h-4 mr-2" /> Tugas Saya</Button></Link>
        <Link href="/penata_pelayanan/faskes"><Button variant="outline"><Building2 className="w-4 h-4 mr-2" /> Faskes Mitra</Button></Link>
        <Link href="/penata_pelayanan/dokumen-operasional"><Button variant="outline"><FileText className="w-4 h-4 mr-2" /> Dokumen Operasional</Button></Link>
      </div>

      {/* Aksi Hari Ini — inline action */}
      <Card>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-600" /> Aksi Hari Ini</CardTitle>
          <Link href="/penata_pelayanan/tugas" className="text-xs text-cyan-700 hover:underline">Lihat semua <ArrowRight className="w-3 h-3 inline" /></Link>
        </CardHeader>
        <CardContent>
          {(allTugas.data || []).length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Belum ada tugas</p>
          ) : (
            <div className="space-y-2">
              {(allTugas.data || []).slice(0, 6).map(p => {
                const isMine = p.current_handler_id === me.id
                const canAmbil = p.takeover_enabled && !isMine
                const daysLeft = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded border ${p.sla_breached ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm truncate">{(p.wpa_faskes as any)?.nama || 'Faskes'}</span>
                        <Badge variant="outline" className="text-[10px]">{JENIS_PENGAJUAN_SHORT[p.jenis] || p.jenis}</Badge>
                        {isMine && <Badge className="bg-cyan-100 text-cyan-800 text-[9px]">Saya Pegang</Badge>}
                        {canAmbil && <Badge className="bg-yellow-100 text-yellow-800 text-[9px]">PP Aktif</Badge>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> {TAHAP_LABELS[p.current_tahap] || p.current_tahap}
                        {p.sla_deadline && <span className={p.sla_breached || (daysLeft !== null && daysLeft < 0) ? 'text-red-700 font-semibold' : ''}>· {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}h lagi` : 'lewat'}</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {isMine ? (
                        <Link href={`/penata_pelayanan/tugas/detail?id=${p.id}`}>
                          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 h-7 text-xs">Lanjutkan</Button>
                        </Link>
                      ) : canAmbil ? (
                        <Link href={`/penata_pelayanan/tugas/detail?id=${p.id}`}>
                          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 h-7 text-xs"><Hand className="w-3 h-3 mr-1" /> Ambil Alih</Button>
                        </Link>
                      ) : (
                        <Link href={`/penata_pelayanan/tugas/detail?id=${p.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs"><Eye className="w-3 h-3" /></Button>
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
    </div>
  )
}
