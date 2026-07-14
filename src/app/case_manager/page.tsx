import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  FileSignature, Building2, ShieldCheck, Calendar, ListChecks, 
  AlertCircle, Clock, FileText, Plus, BarChart3
} from 'lucide-react'

function getReminderColor(daysLeft: number): { color: string; label: string; bg: string } {
  if (daysLeft < 0) return { color: 'text-red-700', label: 'Lewat', bg: 'bg-red-100 border-red-300' }
  if (daysLeft <= 14) return { color: 'text-red-700', label: '2 minggu', bg: 'bg-red-100 border-red-300' }
  if (daysLeft <= 30) return { color: 'text-orange-700', label: '1 bulan', bg: 'bg-orange-100 border-orange-300' }
  if (daysLeft <= 90) return { color: 'text-yellow-700', label: '3 bulan', bg: 'bg-yellow-100 border-yellow-300' }
  return { color: 'text-green-700', label: 'Aman', bg: 'bg-green-100 border-green-300' }
}

export default async function CaseManagerDashboard() {
  const user = await getSession()
  if (!user) return null
  
  const now = new Date()
  const inThreeMonths = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())
  
  const [pengajuanMenunggu, kredensialingProgress, draftSaya, adendumPending, droppingSaya, pksAkanHabis] = await Promise.all([
    // Pengajuan faskes menunggu tinjauan
    supabaseAdmin.from('wpa_faskes_pengajuan')
      .select('id, faskes_id, status, perihal, created_at, wpa_faskes(nama)')
      .in('status', ['diajukan', 'ditinjau'])
      .order('created_at', { ascending: false }),
    // Kredensialing in progress
    supabaseAdmin.from('wpa_faskes_pengajuan')
      .select('id, status, wpa_faskes(nama)')
      .eq('status', 'kredensialing')
      .eq('assigned_case_manager_id', user.id),
    // PKS draft yang saya pegang
    supabaseAdmin.from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, status, updated_at, wpa_faskes(nama)')
      .eq('assigned_case_manager_id', user.id)
      .in('status', ['draft', 'negosiasi', 'review_legal'])
      .order('updated_at', { ascending: false }),
    // Adendum pending
    supabaseAdmin.from('wpa_pks_adendum')
      .select('id, jenis, status, created_at, wpa_pks(faskes_id)')
      .in('status', ['draft', 'negosiasi'])
      .order('created_at', { ascending: false }),
    // Dropping yang assigned ke saya & belum selesai
    supabaseAdmin.from('wpa_dropping_pusat_target')
      .select('id, status, deadline_at:dropping_id(deadline_draft,deadline_tanda_tangan),dropping_id(judul,kode_dropping)')
      .eq('assigned_case_manager_id', user.id)
      .in('status', ['pending', 'drafting', 'review_legal_bpjs'])
      .order('created_at', { ascending: false }),
    // PKS akan habis dalam 3 bulan
    supabaseAdmin.from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, tanggal_berakhir, wpa_faskes(nama)')
      .eq('status', 'ditandatangani')
      .gte('tanggal_berakhir', now.toISOString().split('T')[0])
      .lte('tanggal_berakhir', inThreeMonths.toISOString().split('T')[0])
      .order('tanggal_berakhir', { ascending: true }),
  ])
  
  const totalPengajuan = pengajuanMenunggu.data?.length || 0
  const totalKredensialing = kredensialingProgress.data?.length || 0
  const totalDraftSaya = draftSaya.data?.length || 0
  const totalAdendum = adendumPending.data?.length || 0
  const totalDropping = droppingSaya.data?.length || 0
  const totalAkanHabis = pksAkanHabis.data?.length || 0
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Case Manager</h1>
          <p className="text-sm text-slate-600">
            Halo {user.full_name}, berikut ringkasan tugas Anda hari ini.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/case_manager/pks/new">
            <Button className="bg-blue-700 hover:bg-blue-800">
              <Plus className="w-4 h-4 mr-2" /> Buat PKS Baru
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className={totalPengajuan > 5 ? 'border-red-300' : ''}>
          <CardContent className="p-4">
            <Building2 className="w-5 h-5 text-blue-700 mb-1" />
            <div className={`text-2xl font-bold ${totalPengajuan > 5 ? 'text-red-700' : 'text-slate-900'}`}>{totalPengajuan}</div>
            <div className="text-xs text-slate-500">Pengajuan Menunggu</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ListChecks className="w-5 h-5 text-teal-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{totalKredensialing}</div>
            <div className="text-xs text-slate-500">Kredensialing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <FileSignature className="w-5 h-5 text-purple-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{totalDraftSaya}</div>
            <div className="text-xs text-slate-500">Draft PKS Saya</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <FileText className="w-5 h-5 text-orange-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{totalAdendum}</div>
            <div className="text-xs text-slate-500">Adendum Pending</div>
          </CardContent>
        </Card>
        <Card className={totalDropping > 0 ? 'border-blue-300 bg-blue-50' : ''}>
          <CardContent className="p-4">
            <ShieldCheck className="w-5 h-5 text-blue-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{totalDropping}</div>
            <div className="text-xs text-slate-500">Dropping Pusat Saya</div>
          </CardContent>
        </Card>
        <Card className={totalAkanHabis > 0 ? 'border-yellow-300 bg-yellow-50' : ''}>
          <CardContent className="p-4">
            <Calendar className="w-5 h-5 text-yellow-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{totalAkanHabis}</div>
            <div className="text-xs text-slate-500">PKS Akan Habis</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pengajuan Menunggu */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700" />
              Pengajuan Faskes Menunggu Tinjauan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pengajuanMenunggu.data && pengajuanMenunggu.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pengajuanMenunggu.data.slice(0, 5).map(p => (
                  <Link key={p.id} href={`/case_manager/onboarding/${p.id}`} className="block">
                    <div className="p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {p.wpa_faskes?.nama || 'Faskes'}
                        </div>
                        <Badge variant="outline" className="text-xs">{p.status}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(p.created_at).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada pengajuan menunggu</p>
            )}
            <Link href="/case_manager/onboarding" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Lihat Semua</Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* Dropping Pusat Aktif */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Dropping Pusat — Yang Saya Pegang
            </CardTitle>
          </CardHeader>
          <CardContent>
            {droppingSaya.data && droppingSaya.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {droppingSaya.data.slice(0, 5).map(d => {
                  const deadline = (d as any).deadline_at
                  return (
                    <Link key={d.id} href={`/case_manager/dropping/${d.id}`} className="block">
                      <div className="p-2 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {(d as any).dropping_id?.judul || 'Dropping'}
                          </div>
                          <Badge className="bg-blue-200 text-blue-900">{d.status}</Badge>
                        </div>
                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Deadline draft: {deadline || '-'}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada dropping aktif</p>
            )}
            <Link href="/case_manager/dropping" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Lihat Semua</Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* PKS Draft Saya */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-purple-700" />
              Draft PKS Yang Saya Pegang
            </CardTitle>
          </CardHeader>
          <CardContent>
            {draftSaya.data && draftSaya.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {draftSaya.data.slice(0, 5).map(p => (
                  <Link key={p.id} href={`/case_manager/pks/${p.id}`} className="block">
                    <div className="p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {p.wpa_faskes?.nama || 'Faskes'}
                        </div>
                        <Badge variant="outline" className="text-xs">{p.status}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {p.kode_pks_pihak_pertama || 'Belum ada nomor'} · {new Date(p.updated_at).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada draft aktif</p>
            )}
          </CardContent>
        </Card>
        
        {/* PKS Akan Habis (Reminder) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-700" />
              PKS Akan Berakhir (≤3 bulan)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pksAkanHabis.data && pksAkanHabis.data.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pksAkanHabis.data.slice(0, 5).map(p => {
                  const daysLeft = Math.ceil((new Date(p.tanggal_berakhir!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  const reminder = getReminderColor(daysLeft)
                  return (
                    <Link key={p.id} href={`/case_manager/pks/${p.id}`} className="block">
                      <div className={`p-2 rounded border ${reminder.bg}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {p.wpa_faskes?.nama || 'Faskes'}
                          </div>
                          <Badge className={`${reminder.bg} ${reminder.color} border-current`}>
                            {reminder.label} ({daysLeft}h)
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Berakhir: {new Date(p.tanggal_berakhir!).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Semua PKS masih aman</p>
            )}
            <Link href="/case_manager/perpanjangan" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">
                <Calendar className="w-3 h-3 mr-2" /> Lihat Semua Reminder
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
