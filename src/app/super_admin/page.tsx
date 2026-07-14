import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  Briefcase, Inbox, ShieldCheck, Building2, FileSignature, 
  BarChart3, Wallet, Users, ListChecks, AlertCircle, TrendingUp,
  Plus, FileText, Clock, ArrowRight
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/auth-constants'

export default async function SuperAdminDashboard() {
  const me = await getSession()
  
  const [kantor, users, pipelines, pksAktif] = await Promise.all([
    supabaseAdmin.from('wpa_kantor_cabang').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('wpa_users').select('role, is_active'),
    supabaseAdmin.from('wpa_pipeline').select('id, jenis, status, current_tahap, kantor_cabang_id').eq('status', 'in_progress'),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('status', 'ditandatangani'),
  ])
  
  const usersByRole = (users.data || []).reduce((acc: Record<string, number>, u: any) => {
    if (u.is_active) acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})
  
  const stats = [
    { label: 'Kantor Cabang', value: kantor.count || 0, icon: Building2, color: 'bg-rose-700' },
    { label: 'Total User Aktif', value: users.data?.filter(u => u.is_active).length || 0, icon: Users, color: 'bg-slate-700' },
    { label: 'Pengajuan In-Progress', value: pipelines.data?.length || 0, icon: Inbox, color: 'bg-blue-700' },
    { label: 'PKS Aktif', value: pksAktif.count || 0, icon: ShieldCheck, color: 'bg-green-700' },
  ]
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Super Admin</h1>
        <p className="text-sm text-slate-600">
          Halo {me?.full_name}. Anda memiliki akses penuh ke sistem Manajemen PLKK lintas cabang.
        </p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className={`${s.color} w-8 h-8 rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="w-4 h-4 text-blue-700" />
              Pengajuan Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipelines.data && pipelines.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pipelines.data.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold">{p.jenis.replace(/_/g, ' ').toUpperCase()}</div>
                      <div className="text-xs text-slate-500">Tahap: {p.current_tahap.replace(/_/g, ' ')}</div>
                    </div>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Belum ada pengajuan in-progress</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link href="/super_admin/kantor">
              <Button variant="outline" className="w-full justify-start"><Building2 className="w-4 h-4 mr-2" /> Kelola Kantor Cabang</Button>
            </Link>
            <Link href="/super_admin/template">
              <Button variant="outline" className="w-full justify-start"><FileText className="w-4 h-4 mr-2" /> Upload Template</Button>
            </Link>
            <Link href="/super_admin/pengajuan">
              <Button variant="outline" className="w-full justify-start"><Inbox className="w-4 h-4 mr-2" /> Lihat Pengajuan</Button>
            </Link>
            <Link href="/super_admin/users">
              <Button variant="outline" className="w-full justify-start"><Users className="w-4 h-4 mr-2" /> Semua User</Button>
            </Link>
            <Link href="/super_admin/audit">
              <Button variant="outline" className="w-full justify-start"><ListChecks className="w-4 h-4 mr-2" /> Audit Log</Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" className="w-full justify-start"><ShieldCheck className="w-4 h-4 mr-2" /> Profil Saya</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
