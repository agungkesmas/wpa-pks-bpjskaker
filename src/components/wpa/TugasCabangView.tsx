'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Building2, Clock, AlertCircle, ChevronRight, Unlock, Lock, Info } from 'lucide-react'
import { toast } from 'sonner'
import { TAHAP_LABELS } from '@/lib/wpa-constants'

interface Pipeline {
  id: string
  jenis: string
  current_tahap: string
  status: string
  sla_deadline: string | null
  sla_breached: boolean
  takeover_enabled: boolean
  wpa_faskes: { nama: string; jenis: string; kota: string } | null
}

interface Props {
  role: 'case_manager' | 'kepala_bidang' | 'penata_pelayanan'
}

export function TugasCabangView({ role }: Props) {
  const router = useRouter()
  const [list, setList] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  
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
              Buka akses PP hanya jika berhalangan (cuti, sakit, beban tinggi). Tombol "Buka PP" ada di tiap kartu tugas.
            </p>
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
      ) : (
        <div className="space-y-3">
          {list.map(p => {
            const daysLeft = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
            const canToggleTakeover = role === 'case_manager' || role === 'kepala_bidang'
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => router.push(`/${role}/tugas/detail?id=${p.id}`)}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Building2 className="w-4 h-4 text-blue-700" />
                        <span className="font-semibold text-slate-900">{p.wpa_faskes?.nama || 'Faskes'}</span>
                        <Badge variant="outline">{p.jenis.replace(/_/g, ' ').toUpperCase()}</Badge>
                        {p.takeover_enabled && (
                          <Badge className="bg-cyan-100 text-cyan-800 flex items-center gap-1">
                            <Unlock className="w-3 h-3" /> PP Aktif
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mb-2">
                        {p.wpa_faskes?.jenis} · {p.wpa_faskes?.kota}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-blue-100 text-blue-800">{TAHAP_LABELS[p.current_tahap] || p.current_tahap}</Badge>
                        {p.sla_deadline && (
                          <span className={`text-xs flex items-center gap-1 ${p.sla_breached || (daysLeft !== null && daysLeft < 0) ? 'text-red-700 font-semibold' : daysLeft !== null && daysLeft <= 3 ? 'text-orange-700' : 'text-slate-500'}`}>
                            <Clock className="w-3 h-3" />
                            {daysLeft !== null && daysLeft >= 0 ? `SLA ${daysLeft}h` : 'SLA lewat'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
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
