import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Briefcase, Inbox, Building2, Wallet, AlertCircle, Clock, ArrowRight, FileText } from 'lucide-react'

export default async function CMDashboard() {
  const me = await getSession()
  if (!me) return null
  
  const [allTugas, faskesAktif, slaBreached] = await Promise.all([
    supabaseAdmin.from('wpa_pipeline').select('id, jenis, current_tahap, sla_deadline, faskes_id, current_handler_id, sla_breached, wpa_faskes(nama, jenis, kota)')
      .eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'in_progress'),
    supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'aktif'),
    supabaseAdmin.from('wpa_pipeline').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('sla_breached', true),
  ])
  
  const myTasks = (allTugas.data || []).filter(t => t.current_handler_id === me.id)
  const unclaimedTasks = (allTugas.data || []).filter(t => t.current_handler_id === null)
  
  const stats = [
    { label: 'Saya Pegang', value: myTasks.length, icon: Briefcase, color: 'bg-blue-700', href: '/case_manager/tugas' },
    { label: 'Belum Diambil', value: unclaimedTasks.length, icon: Inbox, color: 'bg-yellow-600', href: '/case_manager/tugas' },
    { label: 'Faskes Mitra', value: faskesAktif.count || 0, icon: Building2, color: 'bg-orange-700', href: '/case_manager/faskes' },
    { label: 'SLA Lewat', value: slaBreached.count || 0, icon: AlertCircle, color: 'bg-red-700', href: '/case_manager/tugas' },
  ]
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Case Manager</h1>
        <p className="text-sm text-slate-600">Halo {me.full_name}. Berikut tugas & aktivitas Anda hari ini.</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className={`${s.color} w-8 h-8 rounded-lg flex items-center justify-center mb-2`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
      
      <Card>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-700" /> Tugas Terkini
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
              {(allTugas.data || []).slice(0, 5).map(p => {
                const isMine = p.current_handler_id === me.id
                const daysLeft = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold">{(p.wpa_faskes as any)?.nama || 'Faskes'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {p.current_tahap.replace(/_/g, ' ')}
                        {p.sla_deadline && <span className={p.sla_breached || (daysLeft !== null && daysLeft < 0) ? 'text-red-700 font-semibold ml-1' : 'ml-1'}>· {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}h` : 'lewat'}</span>}
                      </div>
                    </div>
                    {isMine 
                      ? <Badge className="bg-blue-100 text-blue-800">Saya Pegang</Badge>
                      : p.current_handler_id === null
                      ? <Badge className="bg-yellow-100 text-yellow-800">Belum Diambil</Badge>
                      : <Badge className="bg-slate-100 text-slate-600">Lainnya</Badge>
                    }
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Aksi Cepat</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/case_manager/tugas"><Button variant="outline" className="w-full justify-start"><Briefcase className="w-4 h-4 mr-2" /> Tugas Saya</Button></Link>
            <Link href="/case_manager/faskes"><Button variant="outline" className="w-full justify-start"><Building2 className="w-4 h-4 mr-2" /> Faskes Mitra</Button></Link>
            <Link href="/case_manager/dokumen-operasional"><Button variant="outline" className="w-full justify-start"><FileText className="w-4 h-4 mr-2" /> Dokumen Operasional</Button></Link>
            <Link href="/case_manager/tarif"><Button variant="outline" className="w-full justify-start"><Wallet className="w-4 h-4 mr-2" /> Bank Tarif</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
