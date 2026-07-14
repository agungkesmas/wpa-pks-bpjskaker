import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ShieldCheck, Calendar, FileText, Clock, AlertCircle, Plus, Building } from 'lucide-react'

function getReminderColor(daysLeft: number) {
  if (daysLeft < 0) return { bg: 'bg-red-50 border-red-300', text: 'text-red-700', label: 'Lewat' }
  if (daysLeft <= 14) return { bg: 'bg-red-50 border-red-300', text: 'text-red-700', label: '2 minggu' }
  if (daysLeft <= 30) return { bg: 'bg-orange-50 border-orange-300', text: 'text-orange-700', label: '1 bulan' }
  if (daysLeft <= 90) return { bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', label: '3 bulan' }
  return { bg: 'bg-green-50 border-green-300', text: 'text-green-700', label: 'Aman' }
}

export default async function PicRsDashboard() {
  const user = await getSession()
  if (!user || !user.faskes_id) return null
  
  const now = new Date()
  
  const [pksAktif, droppingMenunggu, dokumenKredensial] = await Promise.all([
    supabaseAdmin.from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, tanggal_mulai, tanggal_berakhir, status, wpa_faskes(nama, jenis, alamat)')
      .eq('faskes_id', user.faskes_id)
      .eq('status', 'ditandatangani')
      .order('tanggal_berakhir', { ascending: false })
      .limit(1),
    supabaseAdmin.from('wpa_dropping_pusat_target')
      .select('id, status, dropping_id(judul, kode_dropping, deadline_tanda_tangan)')
      .eq('faskes_id', user.faskes_id)
      .in('status', ['pending', 'review_legal_rs', 'final'])
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('wpa_faskes_credentials')
      .select('id, jenis, nomor, tanggal_berakhir, verified')
      .eq('faskes_id', user.faskes_id)
      .order('tanggal_berakhir', { ascending: true }),
  ])
  
  const pks = pksAktif.data?.[0] as any
  const faskesNama = pks?.wpa_faskes?.nama || 'Faskes'
  const daysLeft = pks?.tanggal_berakhir ? Math.ceil((new Date(pks.tanggal_berakhir).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
  const reminder = daysLeft !== null ? getReminderColor(daysLeft) : null
  
  const dokumenAkanHabis = (dokumenKredensial.data || []).filter(d => 
    d.tanggal_berakhir && Math.ceil((new Date(d.tanggal_berakhir).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 90
  )
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard PIC RS</h1>
        <p className="text-sm text-slate-600">
          Halo {user.full_name}, status PKS & dokumen {faskesNama}.
        </p>
      </div>
      
      {/* Status PKS Card Besar */}
      {pks ? (
        <Card className={`${reminder?.bg} border-2`}>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Status PKS Aktif</div>
                <div className="text-2xl font-bold text-slate-900 mb-2">{faskesNama}</div>
                <div className="text-sm text-slate-600 space-y-1">
                  <div>Nomor PKS: <span className="font-semibold">{pks.kode_pks_pihak_pertama || '-'}</span></div>
                  <div>Masa: {pks.tanggal_mulai ? new Date(pks.tanggal_mulai).toLocaleDateString('id-ID') : '-'} s/d {pks.tanggal_berakhir ? new Date(pks.tanggal_berakhir).toLocaleDateString('id-ID') : '-'}</div>
                </div>
              </div>
              <div className="text-center">
                {daysLeft !== null && reminder && (
                  <>
                    <div className={`text-4xl font-bold ${reminder.text}`}>{daysLeft}</div>
                    <div className="text-xs text-slate-500">hari lagi</div>
                    <Badge className={`mt-2 ${reminder.bg} ${reminder.text} border-current`}>{reminder.label}</Badge>
                  </>
                )}
              </div>
            </div>
            {daysLeft !== null && daysLeft <= 90 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <Link href="/pic_rs/perpanjangan">
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4 mr-2" /> Ajukan Perpanjangan
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Belum ada PKS aktif untuk faskes Anda. Hubungi Case Manager BPJS.</p>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dropping Pusat Menunggu */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Dropping Pusat — Menunggu Tindakan RS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {droppingMenunggu.data && droppingMenunggu.data.length > 0 ? (
              <div className="space-y-2">
                {droppingMenunggu.data.map(d => {
                  const dropping = (d as any).dropping_id
                  const daysLeftDropping = dropping?.deadline_tanda_tangan ? Math.ceil((new Date(dropping.deadline_tanda_tangan).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
                  return (
                    <Link key={d.id} href={`/pic_rs/dropping/${d.id}`} className="block">
                      <div className={`p-3 rounded border ${daysLeftDropping !== null && daysLeftDropping < 7 ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800 truncate">{dropping?.judul}</div>
                          <Badge className="bg-blue-200 text-blue-900">{d.status}</Badge>
                        </div>
                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> 
                          {daysLeftDropping !== null ? `${daysLeftDropping} hari lagi` : 'no deadline'}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Tidak ada dropping menunggu</p>
            )}
            <Link href="/pic_rs/dropping" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Lihat Semua</Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* Dokumen Kredensial */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-700" />
              Dokumen Kredensial
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dokumenKredensial.data && dokumenKredensial.data.length > 0 ? (
              <div className="space-y-2">
                {dokumenKredensial.data.slice(0, 5).map(d => {
                  const daysLeftDoc = d.tanggal_berakhir ? Math.ceil((new Date(d.tanggal_berakhir).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
                  const isExpiringSoon = daysLeftDoc !== null && daysLeftDoc <= 90
                  return (
                    <div key={d.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{d.jenis}</div>
                        <div className="text-xs text-slate-500">
                          {d.tanggal_berakhir ? `Berakhir: ${new Date(d.tanggal_berakhir).toLocaleDateString('id-ID')}` : 'Tanpa expiry'}
                        </div>
                      </div>
                      {d.verified ? (
                        <Badge className="bg-green-100 text-green-800">Verified</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      )}
                      {isExpiringSoon && (
                        <Badge className="bg-red-100 text-red-800 ml-1">Akan Habis</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Belum ada dokumen terdaftar</p>
            )}
            <Link href="/pic_rs/dokumen" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Kelola Dokumen</Button>
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link href="/pic_rs/perpanjangan">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" /> Ajukan Perpanjangan
              </Button>
            </Link>
            <Link href="/pic_rs/adendum">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="w-4 h-4 mr-2" /> Ajukan Adendum Harga
              </Button>
            </Link>
            <Link href="/pic_rs/pks">
              <Button variant="outline" className="w-full justify-start">
                <Building className="w-4 h-4 mr-2" /> Lihat Detail PKS
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
