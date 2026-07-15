'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Building2, Clock, AlertCircle, Unlock, Lock, Info, UserCircle, FileText, Calendar, Search, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { TAHAP_LABELS, JENIS_PENGAJUAN_SHORT } from '@/lib/wpa-constants'

// Lazy load DroppingPusatView
const DroppingPusatView = dynamic(
  () => import('./DroppingPusatView').then(m => ({ default: m.DroppingPusatView })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> }
)

interface Pipeline {
  id: string
  jenis: string
  current_tahap: string
  status: string
  sla_deadline: string | null
  sla_breached: boolean
  takeover_enabled: boolean
  initiated_by: string | null
  initiated_at: string
  updated_at: string
  dokumen_count?: number
  wpa_faskes: { nama: string; jenis: string; kota: string; tipe?: string } | null
  wpa_pks?: { id: string; kode_pks_pihak_pertama: string | null; tanggal_berakhir: string | null } | null
  wpa_users?: { id: string; full_name: string; email: string; role: string; phone: string | null } | null
}

interface Props {
  role: 'case_manager' | 'kepala_bidang' | 'penata_pelayanan'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days} hari lalu`
  if (hours > 0) return `${hours} jam lalu`
  if (minutes > 0) return `${minutes} menit lalu`
  return 'baru saja'
}

function formatDeadline(dateStr: string): { text: string; urgent: boolean; overdue: boolean } {
  const deadline = new Date(dateStr).getTime()
  const now = Date.now()
  const diff = deadline - now
  const daysLeft = Math.ceil(diff / 86400000)
  const hoursLeft = Math.ceil(diff / 3600000)
  if (diff < 0) return { text: `Lewat ${Math.abs(daysLeft)}h`, urgent: true, overdue: true }
  if (hoursLeft < 24) return { text: `${hoursLeft} jam lagi`, urgent: true, overdue: false }
  return { text: `${daysLeft} hari lagi`, urgent: daysLeft <= 3, overdue: false }
}

function daysUntilExpired(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export function TugasCabangView({ role }: Props) {
  // Wrapper dengan tabs: Approval | Semua Tugas | Dropping Pusat
  return (
    <Tabs defaultValue="all" className="space-y-4">
      <TabsList>
        <TabsTrigger value="approval" className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Approval
        </TabsTrigger>
        <TabsTrigger value="all">Semua Tugas</TabsTrigger>
        <TabsTrigger value="dropping">Dropping Pusat</TabsTrigger>
      </TabsList>
      <TabsContent value="approval">
        <TugasCabangIndividual role={role} filterTahap="approval_kabid" title="Antrean Approval" />
      </TabsContent>
      <TabsContent value="all">
        <TugasCabangIndividual role={role} title="Tugas Cabang" />
      </TabsContent>
      <TabsContent value="dropping">
        <DroppingPusatView role={role as any} />
      </TabsContent>
    </Tabs>
  )
}

function TugasCabangIndividual({ role, filterTahap, title: _title }: Props & { filterTahap?: string; title?: string }) {
  const router = useRouter()
  const [list, setList] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterJenis, setFilterJenis] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'sla' | 'initiated' | 'updated'>('sla')

  useEffect(() => {
    async function fetchList() {
      try {
        const url = filterTahap
          ? `/api/pipeline/list?cabang_only=true&tahap=${filterTahap}`
          : '/api/pipeline/list?cabang_only=true'
        const res = await fetch(url)
        const data = await res.json()
        setList(data.data || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchList()
  }, [])

  async function toggleTakeover(p: Pipeline, enable: boolean) {
    setTogglingId(p.id)
    const reason = enable ? prompt('Alasan membuka akses Penata Pelayanan?') : ''
    if (enable && !reason) { setTogglingId(null); return }
    try {
      const res = await fetch('/api/pipeline/takeover-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: p.id, enabled: enable, reason })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setList(prev => prev.map(item => item.id === p.id ? { ...item, takeover_enabled: enable } : item))
      toast.success(data.message)
    } catch (e: any) { toast.error(e.message) }
    finally { setTogglingId(null) }
  }

  const filteredList = useMemo(() => {
    let result = [...list]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        (p.wpa_faskes?.nama || '').toLowerCase().includes(q) ||
        (p.wpa_faskes?.kota || '').toLowerCase().includes(q) ||
        (p.wpa_users?.full_name || '').toLowerCase().includes(q)
      )
    }
    if (filterJenis !== 'all') result = result.filter(p => p.jenis === filterJenis)
    result.sort((a, b) => {
      if (sortBy === 'sla') {
        const aTime = a.sla_deadline ? new Date(a.sla_deadline).getTime() : Infinity
        const bTime = b.sla_deadline ? new Date(b.sla_deadline).getTime() : Infinity
        return aTime - bTime
      }
      if (sortBy === 'initiated') return new Date(b.initiated_at).getTime() - new Date(a.initiated_at).getTime()
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return result
  }, [list, search, filterJenis, sortBy])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tugas Cabang</h1>
        <p className="text-sm text-slate-600">
          {role === 'case_manager' && 'Semua tugas in-progress di kantor cabang Anda. Bisa Ambil Alih atau Buka Akses Penata Pelayanan.'}
          {role === 'penata_pelayanan' && 'Tugas yang BUKA untuk Penata Pelayanan (CM/Kabid membuka akses). Klik "Ambil Alih" untuk lanjutkan.'}
          {role === 'kepala_bidang' && 'Semua tugas in-progress di cabang. Bisa Ambil Alih kalau perlu.'}
        </p>
      </div>

      {role === 'case_manager' && (
        <Card className="bg-cyan-50 border-cyan-200">
          <CardContent className="p-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-700" />
            <p className="text-xs text-cyan-900">
              <strong>Logika Buka-Tutup:</strong> Defaultnya hanya Anda (CM) & Kabid yang bisa handle tugas.
              Buka akses PP hanya jika berhalangan.
            </p>
          </CardContent>
        </Card>
      )}

      {list.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari faskes, kota, PIC RS..." className="pl-8" />
              </div>
              <select value={filterJenis} onChange={e => setFilterJenis(e.target.value)} className="border border-slate-200 rounded px-3 py-2 text-sm bg-white">
                <option value="all">Semua Jenis</option>
                <option value="pks_baru">PKS Baru</option>
                <option value="perpanjangan">Perpanjangan</option>
                <option value="adendum_harga">Adendum Tarif</option>
                <option value="adendum_layanan_baru">Adendum Layanan</option>
                <option value="adendum_dropping">Dropping Pusat</option>
                <option value="adendum_masal">Adendum Masal</option>
                <option value="perubahan_data">Perubahan Data</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="border border-slate-200 rounded px-3 py-2 text-sm bg-white">
                <option value="sla">Sort: SLA urgent</option>
                <option value="initiated">Sort: Terbaru diajukan</option>
                <option value="updated">Sort: Terbaru update</option>
              </select>
            </div>
            <div className="text-xs text-slate-500">{filteredList.length} dari {list.length} tugas</div>
          </CardContent>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              {role === 'penata_pelayanan'
                ? 'Belum ada tugas yang BUKA untuk Penata Pelayanan. CM/Kabid belum membuka akses.'
                : 'Tidak ada tugas in-progress di cabang'}
            </p>
          </CardContent>
        </Card>
      ) : filteredList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Tidak ada tugas yang cocok dengan filter</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearch(''); setFilterJenis('all') }}>Reset Filter</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredList.map(p => {
            const deadline = p.sla_deadline ? formatDeadline(p.sla_deadline) : null
            const slaClass = deadline?.overdue ? 'text-red-700 font-semibold' : deadline?.urgent ? 'text-orange-700' : 'text-slate-500'
            const pksExpiryDays = p.wpa_pks?.tanggal_berakhir ? daysUntilExpired(p.wpa_pks.tanggal_berakhir) : null
            const canToggleTakeover = role === 'case_manager' || role === 'kepala_bidang'
            return (
              <Card key={p.id} className={`hover:shadow-md transition-shadow ${deadline?.overdue ? 'border-red-300' : deadline?.urgent ? 'border-orange-200' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 cursor-pointer min-w-0" onClick={() => router.push(`/${role}/tugas/detail?id=${p.id}`)}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Building2 className="w-4 h-4 text-blue-700 flex-shrink-0" />
                        <span className="font-semibold text-slate-900 truncate">{p.wpa_faskes?.nama || 'Faskes'}</span>
                        <Badge variant="outline" className="text-[10px]">{JENIS_PENGAJUAN_SHORT[p.jenis] || p.jenis.replace(/_/g, ' ')}</Badge>
                        {p.takeover_enabled && (
                          <Badge className="bg-cyan-100 text-cyan-800 flex items-center gap-1">
                            <Unlock className="w-3 h-3" /> PP Aktif
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mb-2 flex items-center gap-3 flex-wrap">
                        <span>{p.wpa_faskes?.jenis}{p.wpa_faskes?.tipe && p.wpa_faskes.tipe !== '-' ? ` ${p.wpa_faskes.tipe}` : ''} · {p.wpa_faskes?.kota}</span>
                        {p.wpa_users && (
                          <span className="flex items-center gap-1"><UserCircle className="w-3 h-3" /> {p.wpa_users.full_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge className="bg-blue-100 text-blue-800">{TAHAP_LABELS[p.current_tahap] || p.current_tahap.replace(/_/g, ' ')}</Badge>
                        {deadline && (
                          <span className={`text-xs flex items-center gap-1 ${slaClass}`}>
                            <Clock className="w-3 h-3" /> {deadline.text}
                          </span>
                        )}
                        {pksExpiryDays !== null && pksExpiryDays <= 90 && (
                          <Badge className={pksExpiryDays < 14 ? 'bg-red-100 text-red-800' : pksExpiryDays < 30 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}>
                            PKS berakhir {pksExpiryDays}h
                          </Badge>
                        )}
                        {p.dokumen_count !== undefined && p.dokumen_count > 0 && (
                          <Badge variant="outline" className="text-[10px]"><FileText className="w-2.5 h-2.5 mr-0.5" /> {p.dokumen_count} file</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> Submit: {timeAgo(p.initiated_at)}</span>
                        {p.updated_at !== p.initiated_at && <span>Update: {timeAgo(p.updated_at)}</span>}
                        {p.wpa_pks?.kode_pks_pihak_pertama && <span>PKS: {p.wpa_pks.kode_pks_pihak_pertama}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {canToggleTakeover ? (
                        p.takeover_enabled ? (
                          <Button size="sm" variant="outline" disabled={togglingId === p.id} onClick={() => toggleTakeover(p, false)}>
                            <Lock className="w-3 h-3 mr-1" /> Tutup PP
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50" disabled={togglingId === p.id} onClick={() => toggleTakeover(p, true)}>
                            <Unlock className="w-3 h-3 mr-1" /> Buka PP
                          </Button>
                        )
                      ) : null}
                      <Button size="sm" variant="default" onClick={() => router.push(`/${role}/tugas/detail?id=${p.id}`)}>
                        {role === 'penata_pelayanan' ? 'Ambil Alih' : 'Lihat Detail'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
