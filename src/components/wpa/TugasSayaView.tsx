'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Building2, Clock, AlertCircle, ChevronRight, Unlock, Lock, Info, User, FileText, Calendar, UserCircle, Search } from 'lucide-react'
import { toast } from 'sonner'
import { TAHAP_LABELS, JENIS_PENGAJUAN_SHORT } from '@/lib/wpa-constants'

// Lazy load AdendumMasalGroupReview + DroppingPusatView (berat, hanya saat tab dibuka)
const AdendumMasalGroupReview = dynamic(
  () => import('./AdendumMasalGroupReview').then(m => ({ default: m.AdendumMasalGroupReview })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> }
)
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
  handler_since: string | null
  takeover_enabled: boolean
  current_handler_id: string | null
  initiated_by: string | null
  initiated_at: string
  updated_at: string
  completed_at: string | null
  faskes_id: string | null
  pks_id: string | null
  dokumen_count?: number
  wpa_faskes: { nama: string; jenis: string; kota: string; tipe?: string } | null
  wpa_kantor_cabang: { nama: string; kode: string } | null
  wpa_pks?: { id: string; kode_pks_pihak_pertama: string | null; tanggal_berakhir: string | null; status: string } | null
  wpa_users?: { id: string; full_name: string; email: string; role: string; phone: string | null } | null
}

interface Props {
  role: 'case_manager' | 'penata_pelayanan' | 'kepala_bidang'
  currentUserId: string
}

// Helper: format relative time
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

// Helper: format deadline
function formatDeadline(dateStr: string): { text: string; urgent: boolean; overdue: boolean } {
  const deadline = new Date(dateStr).getTime()
  const now = Date.now()
  const diff = deadline - now
  const daysLeft = Math.ceil(diff / 86400000)
  const hoursLeft = Math.ceil(diff / 3600000)

  if (diff < 0) {
    return { text: `Lewat ${Math.abs(daysLeft)}h`, urgent: true, overdue: true }
  }
  if (hoursLeft < 24) {
    return { text: `${hoursLeft} jam lagi`, urgent: true, overdue: false }
  }
  return { text: `${daysLeft} hari lagi`, urgent: daysLeft <= 3, overdue: false }
}

// Helper: days until PKS expired (untuk perpanjangan)
function daysUntilExpired(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export function TugasSayaView({ role, currentUserId }: Props) {
  // Wrapper dengan tabs: Individual | Adendum Masal | Dropping Pusat
  // Hanya CM & Kabid yang lihat semua tabs. PP hanya lihat "Individual"
  const showAllTabs = role === 'case_manager' || role === 'kepala_bidang'

  if (!showAllTabs) {
    // PP: langsung tampilkan individual saja (tanpa tabs)
    return <TugasIndividual role={role} currentUserId={currentUserId} />
  }

  return (
    <Tabs defaultValue="individual" className="space-y-4">
      <TabsList>
        <TabsTrigger value="individual">Individual</TabsTrigger>
        <TabsTrigger value="masal">Adendum Masal</TabsTrigger>
        <TabsTrigger value="dropping">Dropping Pusat</TabsTrigger>
      </TabsList>
      <TabsContent value="individual">
        <TugasIndividual role={role} currentUserId={currentUserId} />
      </TabsContent>
      <TabsContent value="masal">
        {role === 'case_manager' ? (
          <AdendumMasalGroupReview />
        ) : (
          <Card><CardContent className="p-8 text-center">
            <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Adendum Masal hanya bisa di-review oleh Case Manager</p>
          </CardContent></Card>
        )}
      </TabsContent>
      <TabsContent value="dropping">
        <DroppingPusatView role={role as any} />
      </TabsContent>
    </Tabs>
  )
}

function TugasIndividual({ role, currentUserId }: Props) {
  const router = useRouter()
  const [list, setList] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterJenis, setFilterJenis] = useState<string>('all')
  const [filterTahap, setFilterTahap] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'sla' | 'initiated' | 'updated'>('sla')

  useEffect(() => {
    async function fetchList() {
      try {
        const res = await fetch('/api/pipeline/list?cabang_only=true')
        const data = await res.json()
        setList(data.data || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchList()
  }, [])

  async function toggleTakeover(p: Pipeline, enable: boolean) {
    setTogglingId(p.id)
    const reason = enable ? prompt('Alasan membuka akses Penata Pelayanan? (mis. CM berhalangan, beban kerja)') : ''
    if (enable && !reason) {
      setTogglingId(null)
      return
    }
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
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTogglingId(null)
    }
  }

  // Filter + sort
  const filteredList = useMemo(() => {
    let result = [...list]

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        (p.wpa_faskes?.nama || '').toLowerCase().includes(q) ||
        (p.wpa_faskes?.kota || '').toLowerCase().includes(q) ||
        (p.wpa_users?.full_name || '').toLowerCase().includes(q)
      )
    }

    // Filter jenis
    if (filterJenis !== 'all') {
      result = result.filter(p => p.jenis === filterJenis)
    }

    // Filter tahap
    if (filterTahap !== 'all') {
      result = result.filter(p => p.current_tahap === filterTahap)
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'sla') {
        // SLA deadline ascending (paling urgent di atas)
        const aTime = a.sla_deadline ? new Date(a.sla_deadline).getTime() : Infinity
        const bTime = b.sla_deadline ? new Date(b.sla_deadline).getTime() : Infinity
        return aTime - bTime
      }
      if (sortBy === 'initiated') {
        return new Date(b.initiated_at).getTime() - new Date(a.initiated_at).getTime()
      }
      if (sortBy === 'updated') {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
      return 0
    })

    return result
  }, [list, search, filterJenis, filterTahap, sortBy])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }

  // Klasifikasi tugas berdasarkan status relatif ke user
  const myTasks = filteredList.filter(p => p.current_handler_id === currentUserId)
  const unclaimedTasks = filteredList.filter(p => p.current_handler_id === null)
  const othersTasks = filteredList.filter(p => p.current_handler_id !== null && p.current_handler_id !== currentUserId)

  // Tahap options untuk filter (dari list yang ada)
  const tahapOptions = Array.from(new Set(list.map(p => p.current_tahap)))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tugas Saya</h1>
        <p className="text-sm text-slate-600">
          {role === 'case_manager' && 'Semua tugas in-progress di cabang Anda. Klik "Lanjutkan" untuk tugas yang Anda pegang, atau "Ambil Alih" untuk tugas yang belum dipegang.'}
          {role === 'penata_pelayanan' && 'Tugas yang Anda pegang + tugas yang dibuka CM/Kabid untuk Penata Pelayanan. Klik "Ambil Alih" untuk mengambil alih.'}
          {role === 'kepala_bidang' && 'Semua tugas in-progress di cabang. Bisa Ambil Alih kalau perlu, atau buka akses untuk Penata Pelayanan.'}
        </p>
      </div>

      {role === 'case_manager' && (
        <Card className="bg-cyan-50 border-cyan-200">
          <CardContent className="p-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-700" />
            <p className="text-xs text-cyan-900">
              <strong>Logika Buka-Tutup:</strong> Defaultnya hanya CM & Kabid yang bisa handle.
              Buka akses PP hanya jika berhalangan. Tombol "Buka PP" ada di tiap kartu tugas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filter & Search Bar */}
      {list.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama faskes, kota, atau PIC RS..."
                  className="pl-8"
                />
              </div>
              <select
                value={filterJenis}
                onChange={e => setFilterJenis(e.target.value)}
                className="border border-slate-200 rounded px-3 py-2 text-sm bg-white"
              >
                <option value="all">Semua Jenis</option>
                <option value="pks_baru">PKS Baru</option>
                <option value="perpanjangan">Perpanjangan</option>
                <option value="adendum_harga">Adendum Tarif</option>
                <option value="adendum_layanan_baru">Adendum Layanan</option>
                <option value="adendum_dropping">Dropping Pusat</option>
                <option value="adendum_masal">Adendum Masal</option>
                <option value="perubahan_data">Perubahan Data</option>
              </select>
              <select
                value={filterTahap}
                onChange={e => setFilterTahap(e.target.value)}
                className="border border-slate-200 rounded px-3 py-2 text-sm bg-white"
              >
                <option value="all">Semua Tahap</option>
                {tahapOptions.map(t => (
                  <option key={t} value={t}>{TAHAP_LABELS[t] || t.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="border border-slate-200 rounded px-3 py-2 text-sm bg-white"
              >
                <option value="sla">Sort: SLA (paling urgent)</option>
                <option value="initiated">Sort: Terbaru diajukan</option>
                <option value="updated">Sort: Terbaru update</option>
              </select>
            </div>
            <div className="text-xs text-slate-500">
              {filteredList.length} dari {list.length} tugas
            </div>
          </CardContent>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Tidak ada tugas in-progress di cabang</p>
          </CardContent>
        </Card>
      ) : filteredList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Tidak ada tugas yang cocok dengan filter</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearch(''); setFilterJenis('all'); setFilterTahap('all') }}>
              Reset Filter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Section 1: Sedang Saya Pegang */}
          {myTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" /> Sedang Saya Pegang ({myTasks.length})
              </h3>
              <div className="space-y-2">
                {myTasks.map(p => <TaskCard key={p.id} p={p} status="mine" role={role} onToggle={toggleTakeover} toggling={togglingId === p.id} onView={() => router.push(`/${role}/tugas/detail?id=${p.id}`)} />)}
              </div>
            </div>
          )}

          {/* Section 2: Belum Diambil (current_handler = null) */}
          {unclaimedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Belum Diambil ({unclaimedTasks.length})
              </h3>
              <div className="space-y-2">
                {unclaimedTasks.map(p => <TaskCard key={p.id} p={p} status="unclaimed" role={role} onToggle={toggleTakeover} toggling={togglingId === p.id} onView={() => router.push(`/${role}/tugas/detail?id=${p.id}`)} />)}
              </div>
            </div>
          )}

          {/* Section 3: Dipegang Orang Lain (CM/PP/Kabid lain) */}
          {othersTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Dipegang Lainnya ({othersTasks.length})
              </h3>
              <div className="space-y-2">
                {othersTasks.map(p => <TaskCard key={p.id} p={p} status="others" role={role} onToggle={toggleTakeover} toggling={togglingId === p.id} onView={() => router.push(`/${role}/tugas/detail?id=${p.id}`)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TaskCard({ p, status, role, onToggle, toggling, onView }: {
  p: Pipeline
  status: 'mine' | 'unclaimed' | 'others'
  role: string
  onToggle: (p: Pipeline, enable: boolean) => void
  toggling: boolean
  onView: () => void
}) {
  const deadline = p.sla_deadline ? formatDeadline(p.sla_deadline) : null
  const slaClass = deadline?.overdue ? 'text-red-700 font-semibold' : deadline?.urgent ? 'text-orange-700' : 'text-slate-500'

  // PKS expiry (untuk perpanjangan urgency)
  const pksExpiryDays = p.wpa_pks?.tanggal_berakhir ? daysUntilExpired(p.wpa_pks.tanggal_berakhir) : null

  const canToggleTakeover = role === 'case_manager' || role === 'kepala_bidang'
  const canAmbilAlih = status === 'unclaimed' || (status === 'others' && p.takeover_enabled && role === 'penata_pelayanan')

  let statusBadge: React.ReactNode = null
  if (status === 'mine') {
    statusBadge = <Badge className="bg-blue-100 text-blue-800">Saya Pegang</Badge>
  } else if (status === 'unclaimed') {
    statusBadge = <Badge className="bg-yellow-100 text-yellow-800">Belum Diambil</Badge>
  } else {
    statusBadge = <Badge className="bg-slate-100 text-slate-600">Dipegang Lainnya</Badge>
    if (p.takeover_enabled) {
      statusBadge = <Badge className="bg-cyan-100 text-cyan-800 flex items-center gap-1"><Unlock className="w-3 h-3" /> PP Aktif</Badge>
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${deadline?.overdue ? 'border-red-300' : deadline?.urgent ? 'border-orange-200' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer min-w-0" onClick={onView}>
            {/* Row 1: Nama faskes + badge jenis + status */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Building2 className="w-4 h-4 text-blue-700 flex-shrink-0" />
              <span className="font-semibold text-slate-900 truncate">{p.wpa_faskes?.nama || 'Faskes'}</span>
              <Badge variant="outline" className="text-[10px]">{JENIS_PENGAJUAN_SHORT[p.jenis] || p.jenis.replace(/_/g, ' ')}</Badge>
              {statusBadge}
            </div>

            {/* Row 2: Info faskes + PIC RS yang submit */}
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-3 flex-wrap">
              <span>{p.wpa_faskes?.jenis}{p.wpa_faskes?.tipe && p.wpa_faskes.tipe !== '-' ? ` ${p.wpa_faskes.tipe}` : ''} · {p.wpa_faskes?.kota}</span>
              {p.wpa_users && (
                <span className="flex items-center gap-1">
                  <UserCircle className="w-3 h-3" />
                  {p.wpa_users.full_name}
                </span>
              )}
            </div>

            {/* Row 3: Tahap + SLA + PKS expiry */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge className="bg-blue-100 text-blue-800">{TAHAP_LABELS[p.current_tahap] || p.current_tahap.replace(/_/g, ' ')}</Badge>
              {deadline && (
                <span className={`text-xs flex items-center gap-1 ${slaClass}`}>
                  <Clock className="w-3 h-3" />
                  {deadline.text}
                </span>
              )}
              {/* PKS expiry badge (untuk perpanjangan) */}
              {pksExpiryDays !== null && pksExpiryDays <= 90 && (
                <Badge className={pksExpiryDays < 14 ? 'bg-red-100 text-red-800' : pksExpiryDays < 30 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}>
                  PKS berakhir {pksExpiryDays}h
                </Badge>
              )}
              {/* Dokumen count */}
              {p.dokumen_count !== undefined && p.dokumen_count > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  <FileText className="w-2.5 h-2.5 mr-0.5" /> {p.dokumen_count} file
                </Badge>
              )}
            </div>

            {/* Row 4: Timeline info (submit time + updated time) */}
            <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                Submit: {timeAgo(p.initiated_at)}
              </span>
              {p.updated_at !== p.initiated_at && (
                <span>Update: {timeAgo(p.updated_at)}</span>
              )}
              {p.wpa_pks?.kode_pks_pihak_pertama && (
                <span>PKS: {p.wpa_pks.kode_pks_pihak_pertama}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            {canToggleTakeover && (
              p.takeover_enabled ? (
                <Button size="sm" variant="outline" disabled={toggling} onClick={() => onToggle(p, false)}>
                  <Lock className="w-3 h-3 mr-1" /> Tutup PP
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50" disabled={toggling} onClick={() => onToggle(p, true)}>
                  <Unlock className="w-3 h-3 mr-1" /> Buka PP
                </Button>
              )
            )}
            {status === 'mine' && (
              <Button size="sm" variant="default" onClick={onView}>Lanjutkan</Button>
            )}
            {canAmbilAlih && (
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={onView}>Ambil Alih</Button>
            )}
            {status === 'others' && !canAmbilAlih && (
              <Button size="sm" variant="ghost" onClick={onView}>Lihat</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
