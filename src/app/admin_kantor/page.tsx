import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Users, FileText, Building2, Wallet, ListChecks, Settings, ShieldCheck, Activity } from 'lucide-react'

export default async function AdminDashboard() {
  const user = await getSession()
  
  const [users, templates, kantor, tarif, audit, pksAktif, droppingAktif, faskesAktif] = await Promise.all([
    supabaseAdmin.from('wpa_users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('wpa_pks_template').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('wpa_kantor_cabang').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('wpa_tarif_bank').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('wpa_audit_logs').select('action, entity_type, created_at, user_id').order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_dropping_pusat').select('id, judul, status, deadline_tanda_tangan').eq('status', 'aktif'),
    supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('status', 'aktif'),
  ])
  
  const stats = [
    { label: 'Total User', value: users.count || 0, icon: Users, color: 'bg-slate-700', href: '/admin_kantor/users' },
    { label: 'Kantor Cabang', value: kantor.count || 0, icon: Building2, color: 'bg-teal-700', href: '/admin_kantor/kantor' },
    { label: 'Template PKS', value: templates.count || 0, icon: FileText, color: 'bg-blue-700', href: '/admin_kantor/templates' },
    { label: 'Bank Tarif', value: tarif.count || 0, icon: Wallet, color: 'bg-orange-600', href: '/admin_kantor/tarif' },
    { label: 'PKS Aktif', value: pksAktif.count || 0, icon: ShieldCheck, color: 'bg-green-700', href: '/admin_kantor' },
    { label: 'Faskes Aktif', value: faskesAktif.count || 0, icon: Building2, color: 'bg-purple-700', href: '/admin_kantor' },
  ]
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin Kantor</h1>
        <p className="text-sm text-slate-600">
          Selamat datang, {user?.full_name}. Kelola user, template, dan konfigurasi sistem.
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
        {/* Dropping Pusat Aktif */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Dropping Pusat Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            {droppingAktif.data && droppingAktif.data.length > 0 ? (
              <div className="space-y-2">
                {droppingAktif.data.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{d.judul}</div>
                      <div className="text-xs text-slate-500">Deadline: {d.deadline_tanda_tangan || '-'}</div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">{d.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Belum ada dropping pusat aktif</p>
            )}
          </CardContent>
        </Card>
        
        {/* Recent Audit Logs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-700" />
              Aktivitas Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audit.data && audit.data.length > 0 ? (
              <div className="space-y-2">
                {audit.data.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs border-b border-slate-100 pb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <span className="font-mono font-semibold text-slate-800">{a.action}</span>
                      <span className="text-slate-500"> · {a.entity_type || '-'}</span>
                    </div>
                    <span className="text-slate-400">{new Date(a.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Belum ada aktivitas tercatat</p>
            )}
            <Link href="/admin_kantor/audit" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">
                <ListChecks className="w-3 h-3 mr-2" /> Lihat Semua Audit Log
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/admin_kantor/users">
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" /> Tambah User
              </Button>
            </Link>
            <Link href="/admin_kantor/templates">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="w-4 h-4 mr-2" /> Upload Template
              </Button>
            </Link>
            <Link href="/admin_kantor/tarif">
              <Button variant="outline" className="w-full justify-start">
                <Wallet className="w-4 h-4 mr-2" /> Input Tarif
              </Button>
            </Link>
            <Link href="/admin_kantor/settings">
              <Button variant="outline" className="w-full justify-start">
                <Settings className="w-4 h-4 mr-2" /> Pengaturan
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
