import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { Plus, Inbox, FileSignature, Wallet, ShieldCheck, AlertCircle, Clock, ArrowRight, Building2, Calendar, Info, UserPlus } from 'lucide-react'
import { AjukanPerpanjanganButton } from '@/components/wpa/AjukanPerpanjanganButton'

export default async function PICRSDashboard() {
  const me = await getSession()
  if (!me) return null

  const { data: userFaskes } = await supabaseAdmin
    .from('wpa_user_faskes')
    .select('id, faskes_id, is_primary, wpa_faskes(id, nama, jenis, status)')
    .eq('user_id', me.id)

  const isTemporary = !userFaskes || userFaskes.length === 0
  const faskesId = userFaskes && userFaskes.length > 0 ? userFaskes[0].faskes_id : null

  // Parallel queries
  const [myPengajuanRes, pksAktifRes] = await Promise.all([
    supabaseAdmin
      .from('wpa_pipeline')
      .select('id, jenis, current_tahap, sla_deadline, sla_breached, initiated_at, status')
      .eq('initiated_by', me.id)
      .eq('status', 'in_progress')
      .order('initiated_at', { ascending: false }),
    faskesId
      ? supabaseAdmin
          .from('wpa_pks')
          .select('id, kode_pks_pihak_pertama, tanggal_mulai, tanggal_berakhir, status')
          .eq('faskes_id', faskesId)
          .eq('status', 'ditandatangani')
          .order('tanggal_berakhir', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const myPengajuan = myPengajuanRes.data || []
  const pksAktif: any = pksAktifRes.data

  let daysLeft: number | null = null
  if (pksAktif?.tanggal_berakhir) {
    daysLeft = Math.ceil((new Date(pksAktif.tanggal_berakhir).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  // Check if perpanjangan already in progress
  let perpanjanganInProgress = false
  if (pksAktif) {
    const { data: existingPipeline } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, status')
      .eq('pks_id', pksAktif.id)
      .eq('jenis', 'perpanjangan')
      .eq('status', 'in_progress')
      .maybeSingle()
    if (existingPipeline) perpanjanganInProgress = true
  }

  // Cek can_submit_pks_baru dari user (kalau PIC RS baru dibuat CM)
  const { data: userInfo } = await supabaseAdmin
    .from('wpa_users')
    .select('can_submit_pks_baru, is_temporary')
    .eq('id', me.id)
    .single()
  const canSubmitPksBaru = userInfo?.can_submit_pks_baru || false
  const isNewAccount = userInfo?.is_temporary || false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard PIC RS</h1>
        <p className="text-sm text-slate-600">
          Halo {me.full_name}. {isTemporary && !canSubmitPksBaru
            ? 'Akun Anda belum terasosiasi ke faskes. Hubungi CM BPJS untuk pengajuan PKS Baru.'
            : canSubmitPksBaru
            ? 'Menu "PKS Baru" sudah aktif. Silakan ajukan PKS Baru.'
            : `Status PKS & aktivitas faskes ${(userFaskes?.[0]?.wpa_faskes as any)?.nama}.`
          }
        </p>
      </div>

      {/* Info: Akun baru dibuat CM */}
      {canSubmitPksBaru && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <UserPlus className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm text-slate-900">Akun Anda Dibuat oleh Case Manager BPJS</div>
                <p className="text-xs text-slate-600 mt-1">
                  Menu <strong>"PKS Baru"</strong> sudah aktif di halaman "Buat Pengajuan". Silakan upload surat pengantar + 7 file wajib.
                  Setelah CM review, Anda akan isi data faskes saat drafting.
                </p>
                <Link href="/pic_rs/ajukan-baru/pks-baru" className="inline-block mt-2">
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-3 h-3 mr-1" /> Ajukan PKS Baru
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PKS Status Card */}
      {pksAktif ? (
        <Card className={daysLeft !== null && daysLeft <= 90 ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'}>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">PKS Aktif</div>
                <div className="text-xl font-bold text-slate-900 mb-2">{(userFaskes?.[0]?.wpa_faskes as any)?.nama}</div>
                <div className="text-sm text-slate-600">
                  Nomor: <span className="font-semibold">{pksAktif.kode_pks_pihak_pertama || '-'}</span><br/>
                  Masa: {pksAktif.tanggal_mulai ? new Date(pksAktif.tanggal_mulai).toLocaleDateString('id-ID') : '-'} s/d {new Date(pksAktif.tanggal_berakhir).toLocaleDateString('id-ID')}
                </div>
              </div>
              <div className="text-center">
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
      ) : isTemporary && !canSubmitPksBaru ? (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-6 text-center">
            <Building2 className="w-10 h-10 text-orange-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Belum Ada Faskes Terdaftar</h3>
            <p className="text-sm text-slate-600 mb-4">
              Hubungi Case Manager BPJS di kantor cabang Anda untuk pengajuan PKS Baru.
            </p>
            <Alert className="bg-blue-50 border-blue-200 text-left">
              <Info className="w-4 h-4 text-blue-700" />
              <div className="text-blue-900 text-xs">
                <strong>Proses PKS Baru:</strong> CM buat akun PIC RS → Anda upload surat + file → CM review → drafting (Anda isi data) → approval → tanda tangan.
              </div>
            </Alert>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <Inbox className="w-5 h-5 text-orange-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{myPengajuan.length}</div>
            <div className="text-xs text-slate-500">Pengajuan Saya (In-Progress)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <FileSignature className="w-5 h-5 text-purple-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{pksAktif ? 1 : 0}</div>
            <div className="text-xs text-slate-500">PKS Aktif</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Wallet className="w-5 h-5 text-blue-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">-</div>
            <div className="text-xs text-slate-500">Tarif Tahun Ini</div>
          </CardContent>
        </Card>
      </div>

      {/* Pengajuan Saya */}
      <Card>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="w-4 h-4 text-orange-700" /> Pengajuan Saya
          </CardTitle>
          <Link href="/pic_rs/pengajuan" className="text-xs text-orange-700 hover:underline">
            Lihat semua <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </CardHeader>
        <CardContent>
          {myPengajuan.length > 0 ? (
            <div className="space-y-2">
              {myPengajuan.slice(0, 5).map(p => {
                const daysLeftP = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold">{p.jenis.replace(/_/g, ' ').toUpperCase()}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Tahap: {p.current_tahap.replace(/_/g, ' ')}
                        {p.sla_deadline && <span className={p.sla_breached || (daysLeftP !== null && daysLeftP < 0) ? 'text-red-700 font-semibold ml-1' : 'ml-1'}>· {daysLeftP !== null && daysLeftP >= 0 ? `${daysLeftP}h` : 'lewat'}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" asChild><Link href={`/pic_rs/pengajuan?p=${p.id}`}>Tracking</Link></Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">Belum ada pengajuan in-progress</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Action */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Aksi Cepat</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/pic_rs/ajukan-baru"><Button className="w-full bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-2" /> Buat Pengajuan</Button></Link>
            <Link href="/pic_rs/pengajuan"><Button variant="outline" className="w-full justify-start"><Inbox className="w-4 h-4 mr-2" /> Pengajuan Saya</Button></Link>
            <Link href="/pic_rs/dokumen"><Button variant="outline" className="w-full justify-start"><FileSignature className="w-4 h-4 mr-2" /> Dokumen Saya</Button></Link>
            <Link href="/pic_rs/tarif"><Button variant="outline" className="w-full justify-start"><Wallet className="w-4 h-4 mr-2" /> Bank Tarif</Button></Link>
            {daysLeft !== null && daysLeft <= 90 && !perpanjanganInProgress && pksAktif && (
              <AjukanPerpanjanganButton pksId={pksAktif.id} variant="quickAction" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
