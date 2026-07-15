'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Loader2, ArrowLeft, Clock, CheckCircle2, Circle, AlertCircle,
  ArrowRight, ArrowLeft as ArrowLeftIcon, XCircle, Hand, User, Calendar, FileText
} from 'lucide-react'
import { toast } from 'sonner'
import { TAHAP_LABELS } from '@/lib/wpa-constants'

// Lazy load DraftingPKSView (berisi TipTap editor ~500KB) — hanya saat dibutuhkan
const DraftingPKSView = dynamic(
  () => import('@/components/wpa/DraftingPKSView').then(m => ({ default: m.DraftingPKSView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Memuat editor...</span>
      </div>
    ),
  }
)

interface PipelineData {
  id: string
  jenis: string
  current_tahap: string
  status: string
  sla_deadline: string | null
  sla_breached: boolean
  current_handler_id: string | null
  handler_since: string | null
  takeover_enabled: boolean
  initiated_at: string
  completed_at: string | null
  wpa_faskes: { nama: string; jenis: string; kota: string } | null
  wpa_kantor_cabang: { nama: string; kode: string } | null
  logs: any[]
  tahap_config: any[]
  wpa_pengajuan_dokumen?: any[]  // alias — API returns as 'documents'
  wpa_pipeline_placeholder_values?: any[]
  wpa_pks_template?: any
}

interface Props {
  role: string
  currentUserId: string
}

export function PipelineDetailView({ role, currentUserId }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const pipelineId = params.get('id')
  
  const [pipeline, setPipeline] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionDialog, setActionDialog] = useState<{ type: string; tahap: string } | null>(null)
  const [actionCatatan, setActionCatatan] = useState('')
  
  useEffect(() => {
    if (!pipelineId) return
    fetchDetail()
  }, [pipelineId])
  
  async function fetchDetail() {
    setLoading(true)
    try {
      const res = await fetch(`/api/pipeline/detail/${pipelineId}`)
      const data = await res.json()
      if (res.ok) setPipeline(data.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  
  async function handleAction(action: string) {
    if (!pipeline) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/pipeline/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: pipeline.id,
          action,
          catatan: actionCatatan,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success(data.message)
      setActionDialog(null)
      setActionCatatan('')
      fetchDetail()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActionLoading(false)
    }
  }
  
  async function handleTakeover() {
    if (!pipeline) return
    const reason = prompt('Alasan Ambil Alih? (opsional)') || ''
    setActionLoading(true)
    try {
      const res = await fetch('/api/pipeline/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: pipeline.id, reason })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
      fetchDetail()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActionLoading(false)
    }
  }
  
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  if (!pipeline) return <div className="text-center py-12"><AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">Pipeline tidak ditemukan</p></div>
  
  const isHandler = pipeline.current_handler_id === currentUserId
  const isCompleted = pipeline.status === 'completed'
  const isRejected = pipeline.status === 'rejected'
  const isCancelled = pipeline.status === 'cancelled'
  
  // Find current tahap index
  const currentIdx = pipeline.tahap_config.findIndex(t => t.tahap === pipeline.current_tahap)
  const completedTahaps = new Set(
    pipeline.logs.filter(l => l.action === 'complete').map(l => l.tahap)
  )
  
  // Can advance?
  const canAdvance = !isCompleted && !isRejected && !isCancelled && (isHandler || role === 'super_admin')
  const canTakeover = !isCompleted && !isRejected && !isCancelled && !isHandler && 
    (role === 'case_manager' || role === 'kepala_bidang' || (role === 'penata_pelayanan' && pipeline.takeover_enabled))
  
  // SLA
  const daysLeft = pipeline.sla_deadline 
    ? Math.ceil((new Date(pipeline.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  
  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Kembali
      </button>
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{pipeline.wpa_faskes?.nama || 'Faskes'}</h1>
        <p className="text-sm text-slate-600">
          {pipeline.jenis.replace(/_/g, ' ').toUpperCase()} · {pipeline.wpa_kantor_cabang?.nama}
        </p>
      </div>
      
      {/* Status banner */}
      <Card className={isCompleted ? 'border-green-300 bg-green-50' : isRejected ? 'border-red-300 bg-red-50' : isCancelled ? 'border-slate-300 bg-slate-50' : 'border-blue-300 bg-blue-50'}>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {isCompleted ? '✅ Pipeline Selesai' : isRejected ? '❌ Pengajuan Ditolak' : isCancelled ? '⚪ Dibatalkan' : '🔄 Sedang Berjalan'}
            </div>
            <div className="text-xs text-slate-600">
              Tahap saat ini: <strong>{TAHAP_LABELS[pipeline.current_tahap] || pipeline.current_tahap}</strong>
              {daysLeft !== null && !isCompleted && (
                <span className={`ml-2 ${pipeline.sla_breached || daysLeft < 0 ? 'text-red-700 font-semibold' : daysLeft <= 3 ? 'text-orange-700' : ''}`}>
                  · SLA: {daysLeft >= 0 ? `${daysLeft} hari lagi` : 'lewat'}
                </span>
              )}
            </div>
          </div>
          {isHandler && !isCompleted && (
            <Badge className="bg-blue-100 text-blue-800">Saya Pegang</Badge>
          )}
          {pipeline.takeover_enabled && (
            <Badge className="bg-cyan-100 text-cyan-800">PP Aktif</Badge>
          )}
        </CardContent>
      </Card>
      
      {/* Action buttons */}
      {!isCompleted && !isRejected && !isCancelled && (
        <div className="flex gap-2 flex-wrap">
          {canAdvance && (
            <Button className="bg-green-700 hover:bg-green-800" disabled={actionLoading} onClick={() => setActionDialog({ type: 'advance', tahap: pipeline.current_tahap })}>
              <ArrowRight className="w-4 h-4 mr-1" /> Lanjutkan ke Tahap Berikutnya
            </Button>
          )}
          {canTakeover && (
            <Button className="bg-cyan-600 hover:bg-cyan-700" disabled={actionLoading} onClick={handleTakeover}>
              <Hand className="w-4 h-4 mr-1" /> Ambil Alih
            </Button>
          )}
          {canAdvance && currentIdx > 0 && (
            <Button variant="outline" disabled={actionLoading} onClick={() => setActionDialog({ type: 'return', tahap: pipeline.current_tahap })}>
              <ArrowLeftIcon className="w-4 h-4 mr-1" /> Kembalikan
            </Button>
          )}
          {canAdvance && (
            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={actionLoading} onClick={() => setActionDialog({ type: 'reject', tahap: pipeline.current_tahap })}>
              <XCircle className="w-4 h-4 mr-1" /> Tolak
            </Button>
          )}
        </div>
      )}
      
      {/* Drafting PKS — tampilkan saat tahap drafting_pks atau drafting_adendum */}
      {pipeline && (pipeline.current_tahap === 'drafting_pks' || pipeline.current_tahap === 'drafting_adendum') && (isHandler || role === 'super_admin') && (
        <DraftingPKSView pipelineId={pipeline.id} onGenerated={() => {}} />
      )}

      {/* Dokumen yang diupload */}
      {(pipeline.wpa_pengajuan_dokumen || (pipeline as any).documents || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Dokumen Pengajuan ({(pipeline.wpa_pengajuan_dokumen || (pipeline as any).documents).length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(pipeline.wpa_pengajuan_dokumen || (pipeline as any).documents).map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{doc.file_name}</div>
                    <div className="text-xs text-slate-500">
                      {doc.jenis.replace(/_/g, ' ')} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '-'}
                      {doc.uploaded_at && ` · ${new Date(doc.uploaded_at).toLocaleDateString('id-ID')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.verified ? (
                      <Badge className="bg-green-100 text-green-800 text-[10px]">Terverifikasi</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Belum Diverifikasi</Badge>
                    )}
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost">Lihat</Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Placeholder values (untuk adendum_masal) */}
      {pipeline.wpa_pipeline_placeholder_values && pipeline.wpa_pipeline_placeholder_values.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Isian Placeholder {pipeline.wpa_pks_template?.judul_kartu ? `— ${pipeline.wpa_pks_template.judul_kartu}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-slate-200 rounded divide-y divide-slate-100">
              {pipeline.wpa_pipeline_placeholder_values.map((ph: any, i: number) => (
                <div key={i} className="flex justify-between p-2 text-sm">
                  <span className="text-slate-600">{ph.placeholder_label || ph.placeholder_key}</span>
                  <strong className="ml-2 text-right">{ph.placeholder_value || '-'}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tracking tahap */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tracking Tahap</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pipeline.tahap_config.map((tahap, idx) => {
              const isCompletedTahap = completedTahaps.has(tahap.tahap) || idx < currentIdx
              const isCurrentTahap = idx === currentIdx && !isCompleted
              const isPending = idx > currentIdx
              const isSkipped = !tahap.is_wajib && isPending && isCompleted
              
              let Icon = Circle
              let bgClass = 'border-slate-200 bg-slate-50'
              let textClass = 'text-slate-500'
              if (isCompletedTahap) { Icon = CheckCircle2; bgClass = 'border-green-300 bg-green-50'; textClass = 'text-green-800' }
              else if (isCurrentTahap) { Icon = Clock; bgClass = 'border-blue-300 bg-blue-50'; textClass = 'text-blue-800' }
              
              return (
                <div key={tahap.tahap} className={`flex items-start gap-3 p-3 rounded border ${bgClass}`}>
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${textClass} ${isCurrentTahap ? 'animate-pulse' : ''}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`font-semibold text-sm ${textClass}`}>
                          {idx + 1}. {TAHAP_LABELS[tahap.tahap] || tahap.tahap.replace(/_/g, ' ')}
                          {!tahap.is_wajib && <span className="text-xs text-slate-400 ml-2">(opsional)</span>}
                        </span>
                        <p className="text-xs text-slate-500">{tahap.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{tahap.handler_role.replace(/_/g, ' ')}</Badge>
                        <span className="text-[10px] text-slate-400">SLA: {tahap.default_sla_days}h</span>
                        {isCompletedTahap && <Badge className="bg-green-100 text-green-800 text-[10px]">Selesai</Badge>}
                        {isCurrentTahap && <Badge className="bg-blue-100 text-blue-800 text-[10px]">Berjalan</Badge>}
                        {isPending && !isSkipped && <Badge variant="outline" className="text-[10px]">Menunggu</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Timeline Aktivitas</CardTitle></CardHeader>
        <CardContent>
          {pipeline.logs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Belum ada aktivitas</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pipeline.logs.map((log, i) => (
                <div key={log.id} className="flex items-start gap-2 text-xs border-b border-slate-100 pb-2 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${log.action === 'complete' ? 'bg-green-500' : log.action === 'enter' ? 'bg-blue-500' : log.action === 'reject' ? 'bg-red-500' : log.action === 'takeover' ? 'bg-cyan-500' : 'bg-slate-400'}`} />
                  <div className="flex-1">
                    <div><strong>{log.action}</strong> · {TAHAP_LABELS[log.tahap] || log.tahap.replace(/_/g, ' ')}</div>
                    {log.catatan && <div className="text-slate-600 mt-0.5">{log.catatan}</div>}
                    {log.sla_actual_hours !== null && <div className="text-slate-400 mt-0.5">⏱ {log.sla_actual_hours} jam</div>}
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
      
      {/* Action dialog */}
      {actionDialog && (
        <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setActionCatatan('') }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actionDialog.type === 'advance' ? 'Lanjutkan ke Tahap Berikutnya?' : actionDialog.type === 'return' ? 'Kembalikan ke Tahap Sebelumnya?' : 'Tolak Pengajuan?'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Catatan (opsional)</Label>
                <Textarea value={actionCatatan} onChange={e => setActionCatatan(e.target.value)} rows={3} 
                  placeholder={actionDialog.type === 'reject' ? 'Alasan penolakan...' : 'Catatan untuk handler berikutnya...'} />
              </div>
              <div className="flex gap-2">
                <Button className={`flex-1 ${actionDialog.type === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-700 hover:bg-green-800'}`} 
                  disabled={actionLoading} onClick={() => handleAction(actionDialog.type)}>
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  {actionDialog.type === 'advance' ? 'Lanjutkan' : actionDialog.type === 'return' ? 'Kembalikan' : 'Tolak'}
                </Button>
                <Button variant="outline" onClick={() => { setActionDialog(null); setActionCatatan('') }}>Batal</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
