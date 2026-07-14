import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Inbox, ShieldCheck, FileSignature, Briefcase, BarChart3, Clock, AlertCircle, TrendingUp, ArrowRight } from 'lucide-react'

export default async function KabidDashboard() {
  const me = await getSession()
  if (!me) return null
  
  const [approvalQueue, tugasCabang, pksAktif, pipelinesBreached] = await Promise.all([
    supabaseAdmin.from('wpa_pipeline').select('id, jenis, current_tahap, sla_deadline, faskes_id').eq('current_tahap', 'approval_kabid').eq('status', 'in_progress'),
    supabaseAdmin.from('wpa_pipeline').select('id, jenis, current_tahap, current_handler_id').eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'in_progress'),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_pipeline').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('sla_breached', true),
  ])
  
  const stats = [
    { label: 'Butuh Approval', value: approvalQueue.data?.length || 0, icon: ShieldCheck, color: 'bg-teal-700', href: '/kepala_bidang/approval' },
    { label: 'Tugas Cabang', value: tugasCabang.data?.length || 0, icon: Briefcase, color: 'bg-blue-700', href: '/kepala_bidang/tugas' },
    { label: 'PKS Aktif', value: pksAktif.count || 0, icon: FileSignature, color: 'bg-green-700', href: '/kepala_bidang/dokumen' },
    { label: 'SLA Breached', value: pipelinesBreached.count || 0, icon: AlertCircle, color: 'bg-red-700', href: '/kepala_bidang/tugas' },
  ]
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Kepala Bidang</h1>
        <p className="text-sm text-slate-600">
          Halo {me.full_name}. Berikut ringkasan tugas & approval di cabang Anda.
        </p>
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
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              Antrean Approval
            </CardTitle>
            <Link href="/kepala_bidang/approval" className="text-xs text-teal-700 hover:underline">
              Lihat semua <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </CardHeader>
          <CardContent>
            {approvalQueue.data && approvalQueue.data.length > 0 ? (
              <div className="space-y-2">
                {approvalQueue.data.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold">{p.jenis.replace(/_/g, ' ').toUpperCase()}</div>
                      <div className="text-xs text-slate-500">Tahap: {p.current_tahap.replace(/_/g, ' ')}</div>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/kepala_bidang/approval?p=${p.id}`}>Tinjau</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada antrean approval</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-700" />
              Tugas Cabang In-Progress
            </CardTitle>
            <Link href="/kepala_bidang/tugas" className="text-xs text-blue-700 hover:underline">
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
                    <Badge variant="outline">{p.current_tahap}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada tugas in-progress</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/kepala_bidang/approval"><Button variant="outline" className="w-full justify-start"><ShieldCheck className="w-4 h-4 mr-2" /> Antrean Approval</Button></Link>
            <Link href="/kepala_bidang/tugas"><Button variant="outline" className="w-full justify-start"><Briefcase className="w-4 h-4 mr-2" /> Tugas Cabang</Button></Link>
            <Link href="/kepala_bidang/pengajuan"><Button variant="outline" className="w-full justify-start"><Inbox className="w-4 h-4 mr-2" /> Pengajuan</Button></Link>
            <Link href="/kepala_bidang/laporan"><Button variant="outline" className="w-full justify-start"><BarChart3 className="w-4 h-4 mr-2" /> Laporan</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
