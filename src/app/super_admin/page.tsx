import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Building2, Users, Inbox, ShieldCheck, FileText, ListChecks,
  ChevronRight, Clock, ArrowRight, Settings
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/auth-constants'
import { TAHAP_LABELS, JENIS_PENGAJUAN_SHORT } from '@/lib/wpa-constants'

export default async function SuperAdminDashboard() {
  const me = await getSession()

  const [kantor, users, pipelines, pksAktif, faskesCount] = await Promise.all([
    supabaseAdmin.from('wpa_kantor_cabang').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('wpa_users').select('role, is_active'),
    supabaseAdmin.from('wpa_pipeline').select('id, jenis, status, current_tahap, kantor_cabang_id, wpa_faskes(nama), wpa_kantor_cabang(nama)').eq('status', 'in_progress').order('current_tahap'),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('status', 'aktif'),
  ])

  const usersByRole = (users.data || []).reduce((acc: Record<string, number>, u: any) => {
    if (u.is_active) acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})

  const stats = [
    { label: 'Kantor Cabang', value: kantor.count || 0, icon: Building2, color: 'bg-rose-700', href: '/super_admin/kantor' },
    { label: 'Total User', value: users.data?.filter(u => u.is_active).length || 0, icon: Users, color: 'bg-slate-700', href: '/super_admin/users' },
    { label: 'Pengajuan Aktif', value: pipelines.data?.length || 0, icon: Inbox, color: 'bg-blue-700', href: '/super_admin/pengajuan' },
    { label: 'PKS Aktif', value: pksAktif.count || 0, icon: ShieldCheck, color: 'bg-green-700', href: '/super_admin/pengajuan' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Halo {me?.full_name}. Akses penuh lintas cabang Mitra PLKK.</p>
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
        <Link href="/super_admin/kantor"><Button className="bg-rose-700 hover:bg-rose-800"><Building2 className="w-4 h-4 mr-2" /> Kelola Kantor</Button></Link>
        <Link href="/super_admin/template"><Button variant="outline"><FileText className="w-4 h-4 mr-2" /> Upload Template</Button></Link>
        <Link href="/super_admin/users"><Button variant="outline"><Users className="w-4 h-4 mr-2" /> Semua User</Button></Link>
        <Link href="/super_admin/audit"><Button variant="outline"><ListChecks className="w-4 h-4 mr-2" /> Audit Log</Button></Link>
        <Link href="/super_admin/settings"><Button variant="outline"><Settings className="w-4 h-4 mr-2" /> Settings</Button></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User per Role */}
        <Card>
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base">User Aktif per Role</CardTitle>
            <Link href="/super_admin/users" className="text-xs text-rose-700 hover:underline">Kelola <ArrowRight className="w-3 h-3 inline" /></Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div key={role} className="flex items-center justify-between p-2 rounded border border-slate-200">
                  <span className="text-sm">{label}</span>
                  <Badge>{usersByRole[role] || 0}</Badge>
                </div>
              ))}
              <div className="flex items-center justify-between p-2 rounded border border-slate-200 bg-slate-50">
                <span className="text-sm font-semibold">Faskes Aktif</span>
                <Badge className="bg-green-100 text-green-800">{faskesCount.count || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pengajuan Aktif — dengan link ke detail */}
        <Card>
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Inbox className="w-4 h-4 text-blue-700" /> Pengajuan Aktif</CardTitle>
            <Link href="/super_admin/pengajuan" className="text-xs text-blue-700 hover:underline">Lihat semua <ArrowRight className="w-3 h-3 inline" /></Link>
          </CardHeader>
          <CardContent>
            {pipelines.data && pipelines.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pipelines.data.slice(0, 6).map(p => (
                  <Link key={p.id} href={`/super_admin/pengajuan?p=${p.id}`}>
                    <div className="flex items-center justify-between p-2 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{(p.wpa_faskes as any)?.nama || 'Faskes'}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {TAHAP_LABELS[p.current_tahap] || p.current_tahap}
                          <span className="text-slate-400">· {(p.wpa_kantor_cabang as any)?.nama || '-'}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{JENIS_PENGAJUAN_SHORT[p.jenis] || p.jenis}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Belum ada pengajuan in-progress</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
