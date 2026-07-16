import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2, MapPin, Phone, Calendar, AlertCircle, UserCircle, KeyRound, Printer, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { CMFaskesManager } from '@/components/wpa/CMFaskesManager'

export default async function CMFaskesPage() {
  const me = await getSession()
  if (!me) return null

  // Parallel: faskes list + PKS yang akan berakhir + PIC RS per faskes
  const [faskesRes, pksBerakhirRes] = await Promise.all([
    supabaseAdmin
      .from('wpa_faskes')
      .select(`
        id, nama, jenis, tipe, status, alamat, kota, provinsi, telp, email,
        penanggung_jawab_nama, penanggung_jawab_phone,
        wpa_user_faskes(
          is_primary,
          wpa_users(id, email, full_name, phone, is_active, must_change_password, temp_password, last_login_at)
        )
      `)
      .eq('kantor_cabang_id', me.kantor_cabang_id)
      .order('nama'),
    supabaseAdmin
      .from('wpa_pks')
      .select('id, kode_pks_pihak_pertama, tanggal_berakhir, faskes_id, wpa_faskes(nama)')
      .eq('kantor_cabang_id', me.kantor_cabang_id)
      .eq('status', 'ditandatangani')
      .gte('tanggal_berakhir', new Date().toISOString().split('T')[0])
      .lte('tanggal_berakhir', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0])
      .order('tanggal_berakhir', { ascending: true }),
  ])

  const faskesList = faskesRes.data || []
  const pksBerakhir = pksBerakhirRes.data || []
  const aktif = faskesList.filter(f => f.status === 'aktif')

  // Cek perpanjangan in-progress
  const pksIds = pksBerakhir.map(p => p.id)
  let perpanjanganInProgress: Record<string, boolean> = {}
  if (pksIds.length > 0) {
    const { data: pipelines } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('pks_id')
      .eq('jenis', 'perpanjangan')
      .eq('status', 'in_progress')
      .in('pks_id', pksIds)
    ;(pipelines || []).forEach(p => { perpanjanganInProgress[p.pks_id] = true })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Faskes Mitra</h1>
        <p className="text-sm text-slate-600">{aktif.length} faskes aktif · {pksBerakhir.length} PKS berakhir ≤90 hari.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-700">{aktif.length}</div><div className="text-xs text-slate-500">Faskes Aktif</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-orange-700">{pksBerakhir.length}</div><div className="text-xs text-slate-500">PKS Berakhir ≤90h</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-slate-900">{faskesList.length}</div><div className="text-xs text-slate-500">Total Faskes</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-blue-700">{faskesList.filter(f => (f.wpa_user_faskes as any[])?.some(uf => uf.wpa_users)).length}</div><div className="text-xs text-slate-500">PIC RS Aktif</div></CardContent></Card>
      </div>

      {/* Faskes Akan Perpanjang */}
      {pksBerakhir.length > 0 && (
        <Card className="border-orange-300">
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <Calendar className="w-4 h-4" /> Faskes Akan Perpanjang (≤90 hari)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pksBerakhir.map(p => {
                const daysLeft = Math.ceil((new Date(p.tanggal_berakhir).getTime() - Date.now()) / 86400000)
                const inProgress = perpanjanganInProgress[p.id]
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded border border-slate-200">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{(p.wpa_faskes as any)?.nama || 'Faskes'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{p.kode_pks_pihak_pertama}</span>
                        <span>· Berakhir: {new Date(p.tanggal_berakhir).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={daysLeft < 14 ? 'bg-red-100 text-red-800' : daysLeft < 30 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}>
                        {daysLeft}h lagi
                      </Badge>
                      {inProgress ? (
                        <Badge className="bg-blue-100 text-blue-800">🔄 Dalam Proses</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">⚠ Belum diajukan</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Faskes Table dengan PIC RS management */}
      <CMFaskesManager faskesList={faskesList as any} />
    </div>
  )
}
