'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Clock, CheckCircle2, Circle, AlertCircle, ArrowLeft, Building2, Calendar } from 'lucide-react'
import Link from 'next/link'

interface Pipeline {
  id: string
  jenis: string
  current_tahap: string
  status: string
  sla_deadline: string | null
  sla_breached: boolean
  initiated_at: string
  updated_at: string
  takeover_enabled: boolean
  wpa_faskes: { nama: string; jenis: string; tipe: string; kota: string } | null
  wpa_kantor_cabang: { nama: string; kode: string } | null
  logs: any[]
  tahap_config: any[]
  documents: any[]
  access_logs: any[]
}

const TAHAP_LABELS: Record<string, string> = {
  diajukan: 'Pengajuan',
  ditinjau: 'Peninjauan Surat',
  kredensialing: 'Kredensialing',
  negosiasi_tarif: 'Negosiasi Tarif',
  drafting_pks: 'Drafting PKS',
  drafting_adendum: 'Drafting Adendum',
  approval_kabid: 'Approval Kabid',
  review_legal_rs: 'Review Legal RS',
  tanda_tangan: 'Tanda Tangan',
}

const TAHAP_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 border-green-300',
  current: 'bg-blue-100 text-blue-800 border-blue-300',
  pending: 'bg-slate-100 text-slate-500 border-slate-200',
  skipped: 'bg-slate-50 text-slate-400 border-slate-200 line-through',
}

export default function PengajuanSayaPage() {
  const params = useSearchParams()
  const pipelineId = params.get('p')
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [list, setList] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'detail'>('list')
  
  useEffect(() => {
    async function fetchList() {
      setLoading(true)
      try {
        const res = await fetch('/api/pipeline/list?initiated_by_me=true')
        const data = await res.json()
        setList(data.data || [])
        if (pipelineId) {
          const target = (data.data || []).find((p: Pipeline) => p.id === pipelineId)
          if (target) {
            setPipeline(target as Pipeline)
            setView('detail')
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchList()
  }, [pipelineId])
  
  async function fetchDetail(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/pipeline/detail/${id}`)
      const data = await res.json()
      if (res.ok) {
        setPipeline(data.data)
        setView('detail')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }
  
  if (view === 'detail' && pipeline) {
    return <PipelineDetail pipeline={pipeline} onBack={() => { setView('list'); setPipeline(null) }} />
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengajuan Saya</h1>
        <p className="text-sm text-slate-600">Riwayat pengajuan yang Anda buat + tracking real-time.</p>
      </div>
      
      {list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">Belum ada pengajuan</p>
            <Link href="/pic_rs/ajukan-baru">
              <Button className="bg-orange-600 hover:bg-orange-700">Ajukan PKS Baru</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => fetchDetail(p.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-orange-600" />
                      <span className="font-semibold text-slate-900">{p.wpa_faskes?.nama || 'Faskes'}</span>
                      <Badge variant="outline">{p.jenis.replace(/_/g, ' ').toUpperCase()}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">
                      {p.wpa_kantor_cabang?.nama} · Dibuat {new Date(p.initiated_at).toLocaleDateString('id-ID')}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={TAHAP_COLORS.current}>{TAHAP_LABELS[p.current_tahap] || p.current_tahap}</Badge>
                      {p.sla_breached && <Badge className="bg-red-100 text-red-800">SLA Lewat</Badge>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline">Lihat Tracking</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineDetail({ pipeline, onBack }: { pipeline: Pipeline; onBack: () => void }) {
  const completedTahaps = new Set(
    pipeline.logs.filter(l => l.action === 'complete').map(l => l.tahap)
  )
  const currentIdx = pipeline.tahap_config.findIndex(t => t.tahap === pipeline.current_tahap)
  
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Kembali ke daftar
      </button>
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{pipeline.wpa_faskes?.nama}</h1>
        <p className="text-sm text-slate-600">
          {pipeline.wpa_faskes?.jenis} · {pipeline.wpa_faskes?.kota} · Dikirim ke {pipeline.wpa_kantor_cabang?.nama}
        </p>
      </div>
      
      {/* Tracking Pipeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tracking Pengajuan</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pipeline.tahap_config.map((tahap, idx) => {
              const isCompleted = completedTahaps.has(tahap.tahap) || idx < currentIdx
              const isCurrent = idx === currentIdx
              const isPending = idx > currentIdx
              const isSkipped = !tahap.is_wajib && isPending && pipeline.status === 'completed'
              
              let stateClass = TAHAP_COLORS.pending
              let Icon = Circle
              if (isCompleted) { stateClass = TAHAP_COLORS.completed; Icon = CheckCircle2 }
              else if (isCurrent) { stateClass = TAHAP_COLORS.current; Icon = Clock }
              else if (isSkipped) { stateClass = TAHAP_COLORS.skipped }
              
              return (
                <div key={tahap.tahap} className={`flex items-start gap-3 p-3 rounded border ${stateClass}`}>
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isCurrent ? 'animate-pulse' : ''}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">
                          {idx + 1}. {TAHAP_LABELS[tahap.tahap] || tahap.tahap.replace(/_/g, ' ')}
                          {!tahap.is_wajib && <span className="text-xs text-slate-500 ml-2">(opsional)</span>}
                        </div>
                        <div className="text-xs text-slate-600">{tahap.description}</div>
                      </div>
                      {isCompleted && <Badge className="bg-green-100 text-green-800">Selesai</Badge>}
                      {isCurrent && <Badge className="bg-blue-100 text-blue-800">Sedang Berjalan</Badge>}
                      {isSkipped && <Badge variant="outline">Skip</Badge>}
                      {isPending && !isSkipped && <Badge variant="outline">Menunggu</Badge>}
                    </div>
                    {/* Show handler & SLA for current tahap */}
                    {isCurrent && pipeline.sla_deadline && (
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> SLA: {new Date(pipeline.sla_deadline).toLocaleDateString('id-ID')}
                        {pipeline.sla_breached && <span className="text-red-700 ml-1 font-semibold">⚠ Lewat</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Timeline Aktivitas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Timeline Aktivitas</CardTitle></CardHeader>
        <CardContent>
          {pipeline.logs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Belum ada aktivitas</p>
          ) : (
            <div className="space-y-2">
              {pipeline.logs.map((log, i) => (
                <div key={log.id} className="flex items-start gap-2 text-xs border-b border-slate-100 pb-2 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div><strong>{log.action}</strong> · {TAHAP_LABELS[log.tahap] || log.tahap.replace(/_/g, ' ')}</div>
                    {log.catatan && <div className="text-slate-600 mt-0.5">{log.catatan}</div>}
                    <div className="text-slate-400 mt-0.5">
                      {log.wpa_users?.full_name || 'Sistem'} · {new Date(log.performed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
