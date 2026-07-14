import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FileSignature, ShieldCheck, ListChecks, Clock, AlertCircle, FileText } from 'lucide-react'

export default async function LegalRsDashboard() {
  const user = await getSession()
  if (!user || !user.faskes_id) return null
  
  const now = new Date()
  
  const [pksMfgReview, droppingMfgReview, signedHistory] = await Promise.all([
    supabaseAdmin.from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, status, updated_at, wpa_faskes(nama)')
      .eq('faskes_id', user.faskes_id)
      .eq('status', 'review_legal')
      .order('updated_at', { ascending: false }),
    supabaseAdmin.from('wpa_dropping_pusat_target')
      .select('id, status, dropping_id(judul, kode_dropping, deadline_tanda_tangan)')
      .eq('faskes_id', user.faskes_id)
      .in('status', ['review_legal_rs', 'final'])
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('wpa_pks_signatures')
      .select('id, pks_id, pihak, signer_name, signer_jabatan, signed_at, wpa_pks(kode_pks_pihak_pertama, wpa_faskes(nama))')
      .order('signed_at', { ascending: false })
      .limit(5),
  ])
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Legal / Pimpinan RS</h1>
        <p className="text-sm text-slate-600">
          Halo {user.full_name}, tinjau dan tandatangani dokumen yang menunggu review legal.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className={pksMfgReview.data && pksMfgReview.data.length > 0 ? 'border-purple-300 bg-purple-50' : ''}>
          <CardContent className="p-4">
            <FileSignature className="w-5 h-5 text-purple-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{pksMfgReview.data?.length || 0}</div>
            <div className="text-xs text-slate-500">PKS Menunggu Review</div>
          </CardContent>
        </Card>
        <Card className={droppingMfgReview.data && droppingMfgReview.data.length > 0 ? 'border-purple-300 bg-purple-50' : ''}>
          <CardContent className="p-4">
            <ShieldCheck className="w-5 h-5 text-blue-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{droppingMfgReview.data?.length || 0}</div>
            <div className="text-xs text-slate-500">Dropping Pusat Menunggu</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ListChecks className="w-5 h-5 text-green-700 mb-1" />
            <div className="text-2xl font-bold text-slate-900">{signedHistory.data?.length || 0}</div>
            <div className="text-xs text-slate-500">Dokumen Ditandatangani (recent)</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PKS Menunggu Review */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-purple-700" />
              PKS Menunggu Review Legal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pksMfgReview.data && pksMfgReview.data.length > 0 ? (
              <div className="space-y-2">
                {pksMfgReview.data.map(p => (
                  <Link key={p.id} href={`/legal_rs/review/${p.id}`} className="block">
                    <div className="p-3 rounded border border-purple-200 bg-purple-50 hover:bg-purple-100">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {p.wpa_faskes?.nama || 'Faskes'}
                        </div>
                        <Badge className="bg-purple-200 text-purple-900">Review</Badge>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {p.kode_pks_pihak_pertama || 'Belum ada nomor'} · Updated {new Date(p.updated_at).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Tidak ada PKS menunggu review</p>
              </div>
            )}
            <Link href="/legal_rs/review" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Lihat Semua</Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* Dropping Menunggu Review */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Dropping Pusat Menunggu Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            {droppingMfgReview.data && droppingMfgReview.data.length > 0 ? (
              <div className="space-y-2">
                {droppingMfgReview.data.map(d => {
                  const dropping = (d as any).dropping_id
                  const daysLeft = dropping?.deadline_tanda_tangan ? Math.ceil((new Date(dropping.deadline_tanda_tangan).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
                  return (
                    <Link key={d.id} href={`/legal_rs/dropping/${d.id}`} className="block">
                      <div className={`p-3 rounded border ${daysLeft !== null && daysLeft < 7 ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800 truncate">{dropping?.judul}</div>
                          <Badge className="bg-blue-200 text-blue-900">{d.status}</Badge>
                        </div>
                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {daysLeft !== null ? `${daysLeft} hari lagi` : 'no deadline'}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Tidak ada dropping menunggu review</p>
              </div>
            )}
            <Link href="/legal_rs/dropping" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full">Lihat Semua</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Signed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-700" />
            Riwayat Dokumen Ditandatangani
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signedHistory.data && signedHistory.data.length > 0 ? (
            <div className="space-y-2">
              {signedHistory.data.map(s => {
                const pks = (s as any).wpa_pks
                return (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {pks?.wpa_faskes?.nama || 'Faskes'} — {pks?.kode_pks_pihak_pertama || ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        Ditandatangani oleh: {s.signer_name} ({s.signer_jabatan}) · Pihak {s.pihak}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.signed_at ? new Date(s.signed_at).toLocaleDateString('id-ID') : '-'}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">Belum ada dokumen yang ditandatangani</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
