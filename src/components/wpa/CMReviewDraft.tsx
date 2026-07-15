'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, CheckCircle2, XCircle, FileText, AlertCircle, Printer, History } from 'lucide-react'
import { toast } from 'sonner'

interface DraftVersion {
  id: string
  version: number | null
  version_label: string
  content_html: string
  char_counts: Record<string, any>
  total_ayat: number
  total_changes: number
  total_outside_tolerance: number
  edit_reason: string | null
  cm_feedback: string | null
  status: string
  takeover_mode: string | null
  edited_at: string
  wpa_users: { full_name: string; email: string; role: string } | null
}

interface Props {
  pipelineId: string
  onActionComplete?: () => void
}

export function CMReviewDraft({ pipelineId, onActionComplete }: Props) {
  const [loading, setLoading] = useState(true)
  const [versions, setVersions] = useState<DraftVersion[]>([])
  const [pipeline, setPipeline] = useState<any>(null)
  const [selectedVersion, setSelectedVersion] = useState<DraftVersion | null>(null)
  const [actionDialog, setActionDialog] = useState<{ type: 'approve' | 'return'; version: DraftVersion } | null>(null)
  const [cmFeedback, setCmFeedback] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [pipelineId])

  async function fetchData() {
    setLoading(true)
    try {
      const [versionsRes, pipelineRes] = await Promise.all([
        fetch(`/api/drafting/versions?pipeline_id=${pipelineId}`).then(r => r.json()),
        fetch(`/api/pipeline/detail/${pipelineId}`).then(r => r.json()),
      ])
      setVersions(versionsRes.data || [])
      setPipeline(pipelineRes.data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Find latest version that needs review (status='draft')
  const pendingReview = versions.find((v: any) => v.status === 'draft')
  const currentIteration = pipeline?.draft_iteration || 0
  const isLastIteration = currentIteration >= 4

  async function handleAction() {
    if (!actionDialog) return
    if (actionDialog.type === 'return' && cmFeedback.trim().length < 5) {
      toast.error('Catatan koreksi wajib diisi saat return (minimal 5 karakter)')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/drafting/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_id: actionDialog.version.id,
          action: actionDialog.type,
          cm_feedback: cmFeedback,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
      setActionDialog(null)
      setCmFeedback('')
      if (data.takeover_required) {
        // CM must takeover — trigger takeover modal
        window.location.reload()  // Reload to show takeover UI
      } else {
        fetchData()
        onActionComplete?.()
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }

  if (!pendingReview) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Tidak ada draft yang menunggu review</p>
          {versions.length > 0 && (
            <p className="text-xs text-slate-400 mt-1">Semua draft sudah diproses.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" /> Review Draft PKS
              </h3>
              <p className="text-xs text-slate-500">
                Iterasi {currentIteration}/4 · {isLastIteration ? 'Jika return → CM takeover' : `Sisa ${4 - currentIteration}x koreksi PIC RS`}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-yellow-100 text-yellow-800">v{pendingReview.version} menunggu review</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Draft info */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Info Draft v{pendingReview.version}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-slate-100 text-slate-700">{pendingReview.total_ayat} paragraf</Badge>
            <Badge className={pendingReview.total_changes > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}>
              {pendingReview.total_changes} perubahan
            </Badge>
            {pendingReview.total_outside_tolerance > 0 ? (
              <Badge className="bg-red-100 text-red-800">⚠️ {pendingReview.total_outside_tolerance} di luar tolerance</Badge>
            ) : (
              <Badge className="bg-green-100 text-green-800">✅ Semua within tolerance</Badge>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Disubmit oleh: {pendingReview.wpa_users?.full_name || '-'} · {new Date(pendingReview.edited_at).toLocaleString('id-ID')}
          </div>
          {pendingReview.edit_reason && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="w-4 h-4 text-yellow-700" />
              <AlertDescription className="text-yellow-900 text-xs">
                <strong>Alasan PIC RS (perubahan di luar tolerance):</strong> {pendingReview.edit_reason}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Char counts detail */}
      {pendingReview.char_counts && Object.keys(pendingReview.char_counts).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Detail Perubahan per Paragraf</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {Object.entries(pendingReview.char_counts).map(([key, v]: [string, any]) => (
                <div key={key} className={`text-xs p-2 rounded border ${v.within_tolerance ? 'border-slate-200' : 'border-red-200 bg-red-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <strong>{key}</strong>
                    <span className={v.delta !== 0 ? 'text-blue-700' : 'text-slate-400'}>
                      {v.original} → {v.current} (delta: {v.delta > 0 ? '+' : ''}{v.delta})
                    </span>
                  </div>
                  {!v.within_tolerance && <span className="text-red-700">⚠️ Di luar tolerance (±10%)</span>}
                  <div className="text-slate-500 italic mt-0.5">{v.preview}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview HTML */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Preview Draft</span>
            <Button size="sm" variant="outline" onClick={() => {
              const printWindow = window.open('', '_blank', 'width=800,height=900')
              if (!printWindow) return
              printWindow.document.write(`<!DOCTYPE html><html><head><title>Draft v${pendingReview.version}</title><style>@page{size:A4;margin:20mm}body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6}</style></head><body>${pendingReview.content_html}</body></html>`)
              printWindow.document.close()
              setTimeout(() => { printWindow.focus(); printWindow.print() }, 500)
            }}>
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border border-slate-200 rounded-lg p-6 overflow-y-auto bg-white"
            style={{ maxHeight: '50vh', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: pendingReview.content_html }}
          />
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-2 sticky bottom-0 bg-white p-3 border-t border-slate-200">
        <Button
          className="bg-green-700 hover:bg-green-800 flex-1"
          onClick={() => { setActionDialog({ type: 'approve', version: pendingReview }); setCmFeedback('') }}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" /> Approve & Lanjut ke Print
        </Button>
        <Button
          className="bg-yellow-600 hover:bg-yellow-700 flex-1"
          onClick={() => { setActionDialog({ type: 'return', version: pendingReview }); setCmFeedback('') }}
        >
          <XCircle className="w-4 h-4 mr-1" /> Return untuk Koreksi {isLastIteration ? '(→ CM Takeover)' : ''}
        </Button>
      </div>

      {/* Version history */}
      {versions.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> History Versions</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {versions.map((v: any) => (
                <div key={v.id} className="text-xs flex items-center gap-2 border-b border-slate-100 pb-1">
                  <Badge variant="outline" className="text-[10px]">{v.version_label === 'final' ? 'FINAL' : `v${v.version}`}</Badge>
                  <span className={v.status === 'returned' ? 'text-yellow-700' : v.status === 'approved' || v.status === 'final' ? 'text-green-700' : 'text-slate-600'}>
                    {v.status}
                  </span>
                  <span className="text-slate-400">{v.total_changes} changes</span>
                  <span className="text-slate-400 ml-auto">{new Date(v.edited_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) { setActionDialog(null); setCmFeedback('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog?.type === 'approve' ? (
                <><CheckCircle2 className="w-5 h-5 text-green-600" /> Approve Draft v{actionDialog?.version.version}?</>
              ) : (
                <><XCircle className="w-5 h-5 text-yellow-600" /> Return Draft v{actionDialog?.version.version} untuk Koreksi?</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionDialog?.type === 'approve' ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-900 text-xs">
                  PIC RS akan terima notifikasi "Draft disetujui". Mereka bisa print untuk tanda tangan basah.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="w-4 h-4 text-yellow-700" />
                  <AlertDescription className="text-yellow-900 text-xs">
                    {isLastIteration
                      ? '⚠️ Ini iterasi terakhir (v4). Jika return → CM harus takeover draft.'
                      : `PIC RS akan terima notifikasi + catatan Anda. Sisa ${4 - currentIteration}x koreksi.`
                    }
                  </AlertDescription>
                </Alert>
                <div>
                  <Label>Catatan Koreksi untuk PIC RS *</Label>
                  <Textarea
                    value={cmFeedback}
                    onChange={e => setCmFeedback(e.target.value)}
                    rows={4}
                    placeholder="Jelaskan apa yang perlu diperbaiki..."
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setCmFeedback('') }}>Batal</Button>
            <Button
              className={actionDialog?.type === 'approve' ? 'bg-green-700 hover:bg-green-800' : 'bg-yellow-600 hover:bg-yellow-700'}
              disabled={actionLoading || (actionDialog?.type === 'return' && cmFeedback.trim().length < 5)}
              onClick={handleAction}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {actionDialog?.type === 'approve' ? 'Approve' : 'Return untuk Koreksi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
