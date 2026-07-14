import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Briefcase, Inbox, Building2, Wallet, ShieldCheck, AlertCircle, Clock, ArrowRight } from 'lucide-react'

export default async function CMDashboard() {
  const me = await getSession()
  if (!me) return null
  
  const [tugasSaya, tugasCabang, faskesAktif, slaBreached] = await Promise.all([
    supabaseAdmin.from('wpa_pipeline').select('id, jenis, current_tahap, sla_deadline, faskes_id, handler_since')
      .eq('current_handler_id', me.id).eq('status', 'in_progress'),
    supabaseAdmin.from('wpa_pipeline').select('id, jenis, current_tahap, current_handler_id')
      .eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'in_progress'),
    supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'aktif'),
    supabaseAdmin.from('wpa_pipeline').select('*', { count: 'exact', head: true }).eq('current_handler_id', me.id).eq('sla_breached', true),
  ])
  
  const stats = [
    { label: 'Tugas Saya', value: tugasSaya.data?.length || 0, icon: Briefcase, color: 'bg-blue-700', href: '/case_manager/tugas' },
    { label: 'Tugas Cabang', value: tugasCabang.data?.length || 0, icon: Inbox, color: 'bg-slate-700', href: '/case_manager/tugas-cabang' },
    { label: 'Faskes Mitra', value: faskesAktif.count || 0, icon: Building2, color: 'bg-orange-700', href: '/case_manager/faskes' },
    { label: 'SLA Breached', value: slaBreached.count || 0, icon: AlertCircle, color: 'bg-red-700', href: '/case_manager/tugas' },
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
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-700" /> Tugas Saya (yang sedang saya pegang)
            </CardTitle>
            <Link href="/case_manager/tugas" className="text-xs text-blue-700 hover:underline">
              Lihat semua <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </CardHeader>
          <CardContent>
            {tugasSaya.data && tugasSaya.data.length > 0 ? (
              <div className="space-y-2">
                {tugasSaya.data.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold">{p.jenis.replace(/_/g, ' ').toUpperCase()}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Tahap: {p.current_tahap.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" asChild><Link href={`/case_manager/tugas?p=${p.id}`}>Lanjutkan</Link></Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada tugas aktif</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="w-4 h-4 text-slate-700" /> Tugas Cabang (bisa Ambil Alih)
            </CardTitle>
            <Link href="/case_manager/tugas-cabang" className="text-xs text-slate-700 hover:underline">
              Lihat semua <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </CardHeader>
          <CardContent>
            {tugasCabang.data && tugasCabang.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tugasCabang.data.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold">{p.jenis.replace(/_/g, ' ').toUpperCase()}</div>
                      <div className="text-xs text-slate-500">Tahap: {p.current_tahap.replace(/_/g, ' ')}</div>
                    </div>
                    <Button size="sm" variant="outline" asChild><Link href={`/case_manager/tugas-cabang?p=${p.id}`}>Ambil Alih</Link></Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada tugas</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Aksi Cepat</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/case_manager/tugas"><Button variant="outline" className="w-full justify-start"><Briefcase className="w-4 h-4 mr-2" /> Tugas Saya</Button></Link>
            <Link href="/case_manager/tugas-cabang"><Button variant="outline" className="w-full justify-start"><Inbox className="w-4 h-4 mr-2" /> Tugas Cabang</Button></Link>
            <Link href="/case_manager/faskes"><Button variant="outline" className="w-full justify-start"><Building2 className="w-4 h-4 mr-2" /> Faskes Mitra</Button></Link>
            <Link href="/case_manager/tarif"><Button variant="outline" className="w-full justify-start"><Wallet className="w-4 h-4 mr-2" /> Bank Tarif</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
