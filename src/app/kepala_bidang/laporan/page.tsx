import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, TrendingUp, AlertCircle, Clock } from 'lucide-react'

export default async function KabidLaporanPage() {
  const me = await getSession()
  if (!me) return null
  
  const [pksAktif, pksDraft, pksBerakhir, slaBreach, pipelines, faskesAktif] = await Promise.all([
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).in('status', ['draft', 'negosiasi', 'review_legal']),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'berakhir'),
    supabaseAdmin.from('wpa_pipeline').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('sla_breached', true),
    supabaseAdmin.from('wpa_pipeline').select('jenis, current_tahap, status, sla_breached').eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'in_progress'),
    supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', me.kantor_cabang_id).eq('status', 'aktif'),
  ])
  
  const stats = [
    { label: 'PKS Aktif', value: pksAktif.count || 0, icon: '✅', color: 'text-green-700' },
    { label: 'PKS Draft', value: pksDraft.count || 0, icon: '📝', color: 'text-yellow-700' },
    { label: 'PKS Berakhir', value: pksBerakhir.count || 0, icon: '⏹', color: 'text-red-700' },
    { label: 'SLA Breached', value: slaBreach.count || 0, icon: '⚠', color: 'text-orange-700' },
    { label: 'Pipeline In-Progress', value: pipelines.data?.length || 0, icon: '🔄', color: 'text-blue-700' },
    { label: 'Faskes Aktif', value: faskesAktif.count || 0, icon: '🏥', color: 'text-teal-700' },
  ]
  
  // Pipeline by jenis
  const byJenis: Record<string, number> = {}
  for (const p of pipelines.data || []) {
    byJenis[p.jenis] = (byJenis[p.jenis] || 0) + 1
  }
  
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Laporan</h1><p className="text-sm text-slate-600">KPI & statistik kantor cabang Anda.</p></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>
      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-teal-700" /> Pipeline per Jenis</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(byJenis).length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Tidak ada pipeline aktif</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(byJenis).map(([jenis, count]) => (
                <div key={jenis} className="flex items-center justify-between p-2 rounded border border-slate-200">
                  <span className="text-sm font-medium">{jenis.replace(/_/g, ' ').toUpperCase()}</span>
                  <Badge>{count} in-progress</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
