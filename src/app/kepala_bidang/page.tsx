import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ShieldCheck, BarChart3, Building2, FileSignature, ListChecks, Calendar, TrendingUp } from 'lucide-react'

export default async function KepalaBidangDashboard() {
  const user = await getSession()
  if (!user) return null
  
  const now = new Date()
  const inThreeMonths = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())
  
  const [pksAktif, akanHabis, droppingAktif, pengajuanBaru, adendumApproval] = await Promise.all([
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_pks')
      .select('id, tanggal_berakhir, wpa_faskes(nama)')
      .eq('status', 'ditandatangani')
      .gte('tanggal_berakhir', now.toISOString().split('T')[0])
      .lte('tanggal_berakhir', inThreeMonths.toISOString().split('T')[0])
      .order('tanggal_berakhir', { ascending: true }),
    supabaseAdmin.from('wpa_dropping_pusat')
      .select('id, kode_dropping, judul, status, deadline_tanda_tangan, target_faskes_count, completed_count')
      .eq('status', 'aktif')
      .order('deadline_tanda_tangan', { ascending: true }),
    supabaseAdmin.from('wpa_faskes_pengajuan')
      .select('id, status, wpa_faskes(nama)')
      .in('status', ['diajukan', 'ditinjau', 'kredensialing'])
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('wpa_pks_adendum')
      .select('id, jenis, status, created_at, wpa_pks(faskes_id)')
      .eq('status', 'negosiasi')
      .order('created_at', { ascending: false }),
  ])
  
  // Pipeline funnel
  const pipeline = {
    pengajuan: (pengajuanBaru.data || []).filter(p => p.status === 'diajukan' || p.status === 'ditinjau').length,
    kredensialing: (pengajuanBaru.data || []).filter(p => p.status === 'kredensialing').length,
    negosiasi: (pengajuanBaru.data || []).filter(p => p.status === 'negosiasi').length,
    drafting: (pengajuanBaru.data || []).filter(p => p.status === 'drafting').length,
  }
  const funnelTotal = pipeline.pengajuan + pipeline.kredensialing + pipeline.negosiasi + pipeline.drafting
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Kepala Bidang Pelayanan</h1>
        <p className="text-sm text-slate-600">
          Selamat datang, {user.full_name}. Pantau kinerja & approval strategis.
        </p>
      </div>
      
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <ShieldCheck className="w-5 h-5 text-green-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{pksAktif.count || 0}</div>
            <div className="text-xs text-slate-500">PKS Aktif</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-300">
          <CardContent className="p-4">
            <Calendar className="w-5 h-5 text-yellow-700 mb-1" />
            <div className="text-2xl font-bold text-yellow-700">{akanHabis.data?.length || 0}</div>
            <div className="text-xs text-slate-500">PKS Akan Habis (≤3bln)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Building2 className="w-5 h-5 text-blue-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{pengajuanBaru.data?.length || 0}</div>
            <div className="text-xs text-slate-500">Faskes Onboarding</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ListChecks className="w-5 h-5 text-orange-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{adendumApproval.data?.length || 0}</div>
            <div className="text-xs text-slate-500">Adendum Mfg Approval</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dropping Pusat Aktif */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Dropping Pusat Aktif — Progress Semua Faskes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {droppingAktif.data && droppingAktif.data.length > 0 ? (
              <div className="space-y-3">
                {droppingAktif.data.slice(0, 4).map(d => {
                  const pct = d.target_faskes_count > 0 ? Math.round((d.completed_count / d.target_faskes_count) * 100) : 0
                  const daysLeft = d.deadline_tanda_tangan ? Math.ceil((new Date(d.deadline_tanda_tangan).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
                  return (
                    <Link key={d.id} href={`/kepala_bidang/dropping/${d.id}`} className="block">
                      <div className={`p-3 rounded border ${daysLeft !== null && daysLeft < 7 ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-semibold text-slate-800 truncate">{d.judul}</div>
                          <Badge variant="outline">{d.kode_dropping}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-700 h-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{pct}%</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {d.completed_count}/{d.target_faskes_count} faskes · {daysLeft !== null ? `${daysLeft}h lagi` : 'no deadline'}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Belum ada dropping pusat aktif</p>
            )}
            <Link href="/kepala_bidang/dropping" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Lihat Semua</Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* Pipeline Onboarding */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-700" />
              Pipeline Onboarding Faskes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelTotal > 0 ? (
              <div className="space-y-2">
                {[
                  { label: 'Pengajuan', count: pipeline.pengajuan, color: 'bg-blue-500' },
                  { label: 'Kredensialing', count: pipeline.kredensialing, color: 'bg-teal-500' },
                  { label: 'Negosiasi Tarif', count: pipeline.negosiasi, color: 'bg-orange-500' },
                  { label: 'Drafting PKS', count: pipeline.drafting, color: 'bg-purple-500' },
                ].map(stage => {
                  const pct = funnelTotal > 0 ? Math.round((stage.count / funnelTotal) * 100) : 0
                  return (
                    <div key={stage.label} className="flex items-center gap-3">
                      <div className="w-28 text-xs text-slate-600">{stage.label}</div>
                      <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div className={`${stage.color} h-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-8 text-right text-xs font-semibold text-slate-700">{stage.count}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Belum ada faskes onboarding</p>
            )}
            <Link href="/kepala_bidang/onboarding" className="block mt-4">
              <Button variant="outline" size="sm" className="w-full">Lihat Pipeline Detail</Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* PKS akan berakhir */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-700" />
              PKS Akan Berakhir (3 Bulan)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {akanHabis.data && akanHabis.data.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {akanHabis.data.slice(0, 5).map(p => {
                  const daysLeft = Math.ceil((new Date(p.tanggal_berakhir!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded border border-yellow-200 bg-yellow-50">
                      <div className="text-sm font-semibold text-slate-800">{p.wpa_faskes?.nama || 'Faskes'}</div>
                      <Badge className={daysLeft < 14 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                        {daysLeft} hari
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Semua PKS masih aman</p>
            )}
            <Link href="/kepala_bidang/reminder" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Lihat Semua</Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* Approval Queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-orange-700" />
              Approval Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adendumApproval.data && adendumApproval.data.length > 0 ? (
              <div className="space-y-2">
                {adendumApproval.data.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded border border-orange-200 bg-orange-50">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{a.jenis}</div>
                      <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString('id-ID')}</div>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">Pending</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada antrian approval</p>
            )}
            <Link href="/kepala_bidang/approval" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Lihat Approval Queue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
