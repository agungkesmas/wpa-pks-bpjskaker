import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FileSignature, FolderOpen, ListChecks, Clock, ArrowRight, ShieldCheck } from 'lucide-react'

export default async function LegalRSDashboard() {
  const me = await getSession()
  if (!me) return null
  
  const [reviewQueue, signedDocs, auditLogs] = await Promise.all([
    // Dokumen yang menunggu review legal RS
    supabaseAdmin.from('wpa_pipeline').select('id, jenis, current_tahap, sla_deadline, pks_id, faskes_id')
      .eq('current_tahap', 'review_legal_rs').eq('status', 'in_progress'),
    // Dokumen yang sudah ditandatangani
    supabaseAdmin.from('wpa_pks_signatures').select('id, pks_id, signed_at, signer_name, wpa_pks(kode_pks_pihak_pertama, faskes_id)')
      .order('signed_at', { ascending: false }).limit(5),
    // Recent audit logs for this user
    supabaseAdmin.from('wpa_audit_logs').select('action, entity_type, created_at').eq('user_id', me.id).order('created_at', { ascending: false }).limit(5),
  ])
  
  const stats = [
    { label: 'Menunggu Review', value: reviewQueue.data?.length || 0, icon: FileSignature, color: 'bg-purple-800', href: '/legal_rs/review' },
    { label: 'Dokumen Ditandatangani', value: signedDocs.data?.length || 0, icon: FolderOpen, color: 'bg-green-700', href: '/legal_rs/dokumen' },
    { label: 'Aktivitas Saya', value: auditLogs.data?.length || 0, icon: ListChecks, color: 'bg-slate-700', href: '/legal_rs/audit' },
  ]
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Legal RS</h1>
        <p className="text-sm text-slate-600">
          Halo {me.full_name}. Tinjau & tandatangani dokumen legal dari BPJS Ketenagakerjaan.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
      
      <Card>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-purple-800" /> Dokumen Menunggu Review
          </CardTitle>
          <Link href="/legal_rs/review" className="text-xs text-purple-700 hover:underline">
            Lihat semua <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </CardHeader>
        <CardContent>
          {reviewQueue.data && reviewQueue.data.length > 0 ? (
            <div className="space-y-2">
              {reviewQueue.data.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded border border-purple-200 bg-purple-50">
                  <div>
                    <div className="text-sm font-semibold">{p.jenis.replace(/_/g, ' ').toUpperCase()}</div>
                    <div className="text-xs text-slate-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> SLA: {p.sla_deadline ? new Date(p.sla_deadline).toLocaleDateString('id-ID') : '-'}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild><Link href={`/legal_rs/review?p=${p.id}`}>Tinjau</Link></Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">Tidak ada dokumen menunggu review</p>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3 flex-row flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-green-700" /> Dokumen Ditandatangani (recent)
          </CardTitle>
          <Link href="/legal_rs/dokumen" className="text-xs text-green-700 hover:underline">
            Lihat semua <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </CardHeader>
        <CardContent>
          {signedDocs.data && signedDocs.data.length > 0 ? (
            <div className="space-y-2">
              {signedDocs.data.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                  <div>
                    <div className="text-sm font-semibold">PKS {(s as any).wpa_pks?.kode_pks_pihak_pertama || '-'}</div>
                    <div className="text-xs text-slate-500">Signed: {s.signed_at ? new Date(s.signed_at).toLocaleDateString('id-ID') : '-'}</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Signed</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">Belum ada dokumen ditandatangani</p>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Aksi Cepat</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link href="/legal_rs/review"><Button variant="outline" className="w-full justify-start"><FileSignature className="w-4 h-4 mr-2" /> Review</Button></Link>
            <Link href="/legal_rs/dokumen"><Button variant="outline" className="w-full justify-start"><FolderOpen className="w-4 h-4 mr-2" /> Dokumen Legal</Button></Link>
            <Link href="/legal_rs/audit"><Button variant="outline" className="w-full justify-start"><ListChecks className="w-4 h-4 mr-2" /> Audit Log</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
