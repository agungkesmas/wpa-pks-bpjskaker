import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import {
  Plus, Inbox, FileSignature, Wallet, Clock, ArrowRight,
  Building2, Calendar, Info, UserPlus, ChevronRight, Zap, Eye
} from 'lucide-react'
import { TAHAP_LABELS, JENIS_PENGAJUAN_SHORT } from '@/lib/wpa-constants'
import { AjukanPerpanjanganButton } from '@/components/wpa/AjukanPerpanjanganButton'

export default async function PICRSDashboard() {
  const me = await getSession()
  if (!me) return null

  const { data: userFaskes } = await supabaseAdmin
    .from('wpa_user_faskes')
    .select('id, faskes_id, is_primary, wpa_faskes(id, nama, jenis, status)')
    .eq('user_id', me.id)

  const faskesId = userFaskes && userFaskes.length > 0 ? userFaskes[0].faskes_id : null

  const [myPengajuanRes, pksAktifRes, userInfoRes] = await Promise.all([
    supabaseAdmin
      .from('wpa_pipeline')
      .select('id, jenis, current_tahap, sla_deadline, sla_breached, initiated_at, status')
      .eq('initiated_by', me.id)
      .eq('status', 'in_progress')
      .order('initiated_at', { ascending: false }),
    faskesId
      ? supabaseAdmin.from('wpa_pks')
          .select('id, kode_pks_pihak_pertama, tanggal_mulai, tanggal_berakhir, status')
          .eq('faskes_id', faskesId).eq('status', 'ditandatangani')
          .order('tanggal_berakhir', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('wpa_users').select('can_submit_pks_baru, is_temporary').eq('id', me.id).single(),
  ])

  const myPengajuan = myPengajuanRes.data || []
  const pksAktif: any = pksAktifRes.data
  const canSubmitPksBaru = userInfoRes.data?.can_submit_pks_baru || false

  let daysLeft: number | null = null
  if (pksAktif?.tanggal_berakhir) {
    daysLeft = Math.ceil((new Date(pksAktif.tanggal_berakhir).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  let perpanjanganInProgress = false
  if (pksAktif) {
    const { data: existing } = await supabaseAdmin
      .from('wpa_pipeline').select('id, status')
      .eq('pks_id', pksAktif.id).eq('jenis', 'perpanjangan').eq('status', 'in_progress').maybeSingle()
    if (existing) perpanjanganInProgress = true
  }

  const stats = [
    { label: 'Pengajuan Aktif', value: myPengajuan.length, icon: Inbox, color: 'bg-orange-600', href: '/pic_rs/pengajuan' },
    { label: 'PKS Aktif', value: pksAktif ? 1 : 0, icon: FileSignature, color: 'bg-green-700', href: '/pic_rs/dokumen' },
    { label: 'Dokumen', value: '-', icon: FileSignature, color: 'bg-purple-700', href: '/pic_rs/dokumen' },
    { label: 'Bank Tarif', value: '-', icon: Wallet, color: 'bg-blue-700', href: '/pic_rs/tarif' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Halo {me.full_name}. {canSubmitPksBaru ? 'Menu PKS Baru sudah aktif.' : `Faskes: ${(userFaskes?.[0]?.wpa_faskes as any)?.nama || '-'}.`}
        </p>
      </div>

      {/* Akun baru — action langsung */}
      {canSubmitPksBaru && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <UserPlus className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-900">Akun Anda Dibuat oleh CM</div>
                <p className="text-xs text-slate-600 mt-1">Menu "PKS Baru" sudah aktif. Upload surat + 7 file wajib.</p>
                <Link href="/pic_rs/ajukan-baru/pks-baru" className="inline-block mt-2">
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700"><Plus className="w-3 h-3 mr-1" /> Ajukan PKS Baru</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PKS Status — dengan action button */}
      {pksAktif ? (
        <Card className={daysLeft !== null && daysLeft <= 90 ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'}>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">PKS Aktif</div>
                <div className="text-xl font-bold text-slate-900 mb-2">{(userFaskes?.[0]?.wpa_faskes as any)?.nama}</div>
                <div className="text-sm text-slate-600">
                  No: <strong>{pksAktif.kode_pks_pihak_pertama || '-'}</strong><br/>
                  Masa: {pksAktif.tanggal_mulai ? new Date(pksAktif.tanggal_mulai).toLocaleDateString('id-ID') : '-'} s/d {new Date(pksAktif.tanggal_berakhir).toLocaleDateString('id-ID')}
                </div>
              </div>
              <div className="text-center flex-shrink-0">
                {daysLeft !== null && (
                  <>
                    <div className={`text-4xl font-bold ${daysLeft < 14 ? 'text-red-700' : daysLeft < 30 ? 'text-orange-700' : daysLeft < 90 ? 'text-yellow-700' : 'text-green-700'}`}>{daysLeft}</div>
                    <div className="text-xs text-slate-500">hari lagi</div>
                    {daysLeft <= 90 && !perpanjanganInProgress && (
                      <AjukanPerpanjanganButton pksId={pksAktif.id} />
                    )}
                    {perpanjanganInProgress && (
                      <Badge className="bg-blue-100 text-blue-800 mt-2">Perpanjangan dalam proses</Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !canSubmitPksBaru ? (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-6 text-center">
            <Building2 className="w-10 h-10 text-orange-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Belum Ada Faskes Terdaftar</h3>
            <p className="text-sm text-slate-600 mb-4">Hubungi Case Manager BPJS untuk pengajuan PKS Baru.</p>
          </CardContent>
        </Card>
      ) : null}

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
        <Link href="/pic_rs/ajukan-baru"><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-2" /> Buat Pengajuan</Button></Link>
        <Link href="/pic_rs/pengajuan"><Button variant="outline"><Inbox className="w-4 h-4 mr-2" /> Pengajuan Saya</Button></Link>
        <Link href="/pic_rs/tarif"><Button variant="outline"><Wallet className="w-4 h-4 mr-2" /> Bank Tarif</Button></Link>
      </div>

      {/* Pengajuan Saya — dengan inline action */}
      <Card>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-600" /> Pengajuan Saya
          </CardTitle>
          <Link href="/pic_rs/pengajuan" className="text-xs text-orange-700 hover:underline">Lihat semua <ArrowRight className="w-3 h-3 inline" /></Link>
        </CardHeader>
        <CardContent>
          {myPengajuan.length > 0 ? (
            <div className="space-y-2">
              {myPengajuan.slice(0, 5).map(p => {
                const daysLeftP = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded border ${p.sla_breached ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px]">{JENIS_PENGAJUAN_SHORT[p.jenis] || p.jenis}</Badge>
                        <Badge className="bg-blue-100 text-blue-800 text-[10px]">{TAHAP_LABELS[p.current_tahap] || p.current_tahap}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Tahap: {TAHAP_LABELS[p.current_tahap] || p.current_tahap}
                        {p.sla_deadline && <span className={p.sla_breached || (daysLeftP !== null && daysLeftP < 0) ? 'text-red-700 font-semibold ml-1' : 'ml-1'}>· {daysLeftP !== null && daysLeftP >= 0 ? `${daysLeftP}h lagi` : 'lewat'}</span>}
                      </div>
                    </div>
                    <Link href={`/pic_rs/pengajuan?p=${p.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs"><Eye className="w-3 h-3 mr-1" /> Tracking</Button>
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">Belum ada pengajuan in-progress</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
