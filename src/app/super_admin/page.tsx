import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Building2, Users, ShieldCheck, Activity, Wallet, FileSignature, Settings } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/auth-constants'

export default async function SuperAdminDashboard() {
  const me = await getSession()
  
  const [kantor, users, pksAktif, droppingAktif, auditLogs] = await Promise.all([
    supabaseAdmin.from('wpa_kantor_cabang').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('wpa_users').select('role, is_active'),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_dropping_pusat').select('id, judul, status, deadline_tanda_tangan').eq('status', 'aktif'),
    supabaseAdmin.from('wpa_audit_logs').select('action, entity_type, created_at, user_id').order('created_at', { ascending: false }).limit(10),
  ])
  
  const usersByRole = (users.data || []).reduce((acc: Record<string, number>, u: any) => {
    if (u.is_active) acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})
  
  const stats = [
    { label: 'Kantor Cabang', value: kantor.count || 0, icon: Building2, color: 'bg-rose-700', href: '/super_admin/kantor' },
    { label: 'Total User Aktif', value: users.data?.filter(u => u.is_active).length || 0, icon: Users, color: 'bg-slate-700', href: '/super_admin/users' },
    { label: 'PKS Aktif', value: pksAktif.count || 0, icon: ShieldCheck, color: 'bg-green-700', href: '/super_admin' },
    { label: 'Dropping Pusat', value: droppingAktif.data?.length || 0, icon: FileSignature, color: 'bg-blue-700', href: '/super_admin' },
  ]
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Super Admin</h1>
        <p className="text-sm text-slate-600">
          Halo {me?.full_name}. Anda memiliki akses ke semua kantor cabang & modul sistem.
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
        {/* User by Role */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">User Aktif per Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div key={role} className="flex items-center justify-between p-2 rounded border border-slate-200">
                  <span className="text-sm">{label}</span>
                  <Badge>{usersByRole[role] || 0}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Activities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-700" />
              Aktivitas Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.data && auditLogs.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auditLogs.data.map((a, i) => (
                  <div key={i} className="text-xs border-b border-slate-100 pb-2">
                    <div className="font-mono font-semibold text-slate-800">{a.action}</div>
                    <div className="text-slate-500 text-[10px]">
                      {a.entity_type || '-'} · {new Date(a.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Belum ada aktivitas</p>
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
            <Link href="/super_admin/kantor">
              <Card className="hover:bg-slate-50 cursor-pointer">
                <CardContent className="p-4 text-center">
                  <Building2 className="w-6 h-6 mx-auto mb-2 text-rose-700" />
                  <div className="text-xs font-semibold">Kelola Kantor Cabang</div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/super_admin/users">
              <Card className="hover:bg-slate-50 cursor-pointer">
                <CardContent className="p-4 text-center">
                  <Users className="w-6 h-6 mx-auto mb-2 text-slate-700" />
                  <div className="text-xs font-semibold">Semua User</div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/super_admin/audit">
              <Card className="hover:bg-slate-50 cursor-pointer">
                <CardContent className="p-4 text-center">
                  <Activity className="w-6 h-6 mx-auto mb-2 text-blue-700" />
                  <div className="text-xs font-semibold">Audit Log</div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/profile">
              <Card className="hover:bg-slate-50 cursor-pointer">
                <CardContent className="p-4 text-center">
                  <Settings className="w-6 h-6 mx-auto mb-2 text-purple-700" />
                  <div className="text-xs font-semibold">Profil Saya</div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
