'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileEdit, CheckCircle2, XCircle, Eye, Building2, Info, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface PendingItem {
  id: string
  jenis: string
  current_tahap: string
  status: string
  initiated_at: string
  completed_at: string | null
  faskes_id: string
  wpa_faskes: { nama: string; jenis: string; kota: string } | null
  wpa_pks_template: { id: string; nama: string; judul_kartu: string | null; kode: string; version: string } | null
  wpa_pipeline_placeholder_values: Array<{
    placeholder_key: string
    placeholder_value: string
    placeholder_label: string
  }>
  wpa_users: { full_name: string; email: string } | null
}

interface GroupedTemplate {
  template_id: string
  template_nama: string
  template_judul_kartu: string
  template_kode: string
  total_pending: number
  items: PendingItem[]
}

export function AdendumMasalGroupReview() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [grouped, setGrouped] = useState<GroupedTemplate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionDialog, setActionDialog] = useState<{ type: 'approve' | 'reject'; ids: string[] } | null>(null)
  const [actionCatatan, setActionCatatan] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [detailItem, setDetailItem] = useState<PendingItem | null>(null)

  useEffect(() => {
    fetchPending()
  }, [])

  async function fetchPending() {
    setLoading(true)
    try {
      const res = await fetch('/api/adendum-masal/list-pending?status=in_progress')
      const data = await res.json()
      if (res.ok) {
        setGrouped(data.grouped || [])
      } else {
        toast.error(data.error)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllInGroup(group: GroupedTemplate) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      group.items.forEach(item => {
        if (item.status === 'in_progress') next.add(item.id)
      })
      return next
    })
  }

  function deselectAllInGroup(group: GroupedTemplate) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      group.items.forEach(item => next.delete(item.id))
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function openActionDialog(type: 'approve' | 'reject') {
    if (selectedIds.size === 0) {
      toast.error('Pilih minimal 1 pengajuan')
      return
    }
    setActionDialog({ type, ids: Array.from(selectedIds) })
    setActionCatatan('')
  }

  async function handleAction() {
    if (!actionDialog) return
    if (actionDialog.type === 'reject' && !actionCatatan.trim()) {
      toast.error('Alasan tolak wajib diisi')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/adendum-masal/group-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_ids: actionDialog.ids,
          action: actionDialog.type,
          catatan: actionCatatan,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
      setActionDialog(null)
      setActionCatatan('')
      setSelectedIds(new Set())
      fetchPending()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }

  const totalPending = grouped.reduce((sum, g) => sum + g.total_pending, 0)

  if (totalPending === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Tidak ada adendum masal yang menunggu review</p>
          <p className="text-xs text-slate-400 mt-1">Semua pengajuan adendum masal sudah diproses.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Alert className="bg-amber-50 border-amber-200">
        <Info className="w-4 h-4 text-amber-700" />
        <AlertDescription className="text-xs text-amber-900">
          <strong>Group Review:</strong> Centang beberapa pengajuan, lalu klik "Setuju Semua" atau "Tolak Semua".
          Jawaban akan dikirim bareng ke semua faskes yang dipilih.
        </AlertDescription>
      </Alert>

      {/* Selection Summary Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <strong>{selectedIds.size}</strong> pengajuan dipilih
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => openActionDialog('approve')}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Setuju Semua ({selectedIds.size})
              </Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => openActionDialog('reject')}>
                <XCircle className="w-3 h-3 mr-1" /> Tolak Semua ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>Batal Pilih</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grouped by Template */}
      {grouped.map(group => (
        <Card key={group.template_id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-600" />
                  {group.template_judul_kartu}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Kode: {group.template_kode} · {group.total_pending} pengajuan menunggu
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => selectAllInGroup(group)}>Pilih Semua</Button>
                <Button size="sm" variant="outline" onClick={() => deselectAllInGroup(group)}>Batal Pilih</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {group.items.map(item => {
                const isSelected = selectedIds.has(item.id)
                const isInProgress = item.status === 'in_progress'
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded border transition-colors ${
                      item.status === 'completed' ? 'border-green-200 bg-green-50/30' :
                      item.status === 'rejected' ? 'border-red-200 bg-red-50/30' :
                      isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(item.id)}
                      disabled={!isInProgress}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-sm">{item.wpa_faskes?.nama || 'Faskes'}</span>
                        <Badge variant="outline">{item.wpa_faskes?.jenis}</Badge>
                        <span className="text-xs text-slate-500">{item.wpa_faskes?.kota}</span>
                        {item.status === 'completed' && <Badge className="bg-green-100 text-green-800">Disetujui</Badge>}
                        {item.status === 'rejected' && <Badge className="bg-red-100 text-red-800">Ditolak</Badge>}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Diajukan oleh: {item.wpa_users?.full_name || '-'} · {new Date(item.initiated_at).toLocaleDateString('id-ID')}
                      </div>
                      {/* Show key placeholders (first 3) */}
                      {item.wpa_pipeline_placeholder_values && item.wpa_pipeline_placeholder_values.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.wpa_pipeline_placeholder_values.slice(0, 5).map((ph, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] bg-slate-50">
                              {ph.placeholder_label}: <strong className="ml-1">{ph.placeholder_value || '-'}</strong>
                            </Badge>
                          ))}
                          {item.wpa_pipeline_placeholder_values.length > 5 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{item.wpa_pipeline_placeholder_values.length - 5} lagi
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setDetailItem(item)}>
                        <Eye className="w-3 h-3 mr-1" /> Detail
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) setActionDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog?.type === 'approve' ? (
                <><CheckCircle2 className="w-5 h-5 text-green-600" /> Setujui {actionDialog?.ids.length || 0} Pengajuan?</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-600" /> Tolak {actionDialog?.ids.length || 0} Pengajuan?</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert className={actionDialog?.type === 'approve' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <AlertCircle className="w-4 h-4" />
              <div className="text-xs">
                {actionDialog?.type === 'approve'
                  ? 'Pengajuan yang disetujui akan otomatis selesai. PIC RS akan terima notifikasi & bisa print PDF untuk TTD basah.'
                  : 'Pengajuan yang ditolak akan ditutup. PIC RS akan terima notifikasi + alasan.'}
              </div>
            </Alert>
            <div>
              <Label>{actionDialog?.type === 'approve' ? 'Catatan (opsional)' : 'Alasan Tolak *'}</Label>
              <Textarea
                value={actionCatatan}
                onChange={e => setActionCatatan(e.target.value)}
                rows={3}
                placeholder={actionDialog?.type === 'approve' ? 'Catatan untuk PIC RS...' : 'Jelaskan alasan penolakan...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Batal</Button>
            <Button
              className={actionDialog?.type === 'approve' ? 'bg-green-700 hover:bg-green-800' : 'bg-red-600 hover:bg-red-700'}
              disabled={actionLoading || (actionDialog?.type === 'reject' && !actionCatatan.trim())}
              onClick={handleAction}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {actionDialog?.type === 'approve' ? 'Setuju' : 'Tolak'} {actionDialog?.ids.length} Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={(o) => { if (!o) setDetailItem(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Pengajuan Adendum Masal</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Faskes</div>
                <div className="font-semibold">{detailItem.wpa_faskes?.nama}</div>
                <div className="text-xs text-slate-500">
                  {detailItem.wpa_faskes?.jenis} · {detailItem.wpa_faskes?.kota}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Template</div>
                <div className="font-semibold">{detailItem.wpa_pks_template?.judul_kartu || detailItem.wpa_pks_template?.nama}</div>
                <div className="text-xs text-slate-500">
                  Kode: {detailItem.wpa_pks_template?.kode} · v{detailItem.wpa_pks_template?.version}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Diajukan Oleh</div>
                <div>{detailItem.wpa_users?.full_name} ({detailItem.wpa_users?.email})</div>
                <div className="text-xs text-slate-500">{new Date(detailItem.initiated_at).toLocaleString('id-ID')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Isian Placeholder</div>
                <div className="border border-slate-200 rounded divide-y divide-slate-100">
                  {detailItem.wpa_pipeline_placeholder_values?.map((ph, i) => (
                    <div key={i} className="flex justify-between p-2 text-xs">
                      <span className="text-slate-600">{ph.placeholder_label || ph.placeholder_key}</span>
                      <strong className="ml-2 text-right">{ph.placeholder_value || '-'}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/case_manager/tugas/detail?id=${detailItem.id}`)}
              >
                Buka Halaman Pipeline Lengkap
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
