'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Save, FileText, CheckCircle2, AlertCircle, Lock, Sparkles, Send, Download } from 'lucide-react'
import { toast } from 'sonner'
import { GenerateDocxButton } from '@/components/wpa/GenerateDocxButton'

interface Placeholder {
  id: string
  key: string
  label: string
  tipe: string
  bab_id: string
  source_table: string | null
  source_column: string | null
  required: boolean
  auto_value: string | null
}

interface Bab {
  id: string
  bab_id: string
  bab_label: string
  bab_type: string
  urutan: number
  content_hash: string
  placeholder_keys: string[]
}

interface DraftingData {
  template: any
  babs: Bab[]
  placeholders: Placeholder[]
  placeholder_by_bab: Record<string, Placeholder[]>
  auto_data: Record<string, string>
  auto_count: number
  manual_required: number
  manual_optional: number
}

interface Props {
  pipelineId: string
  onGenerated?: () => void
}

const TIPE_COLORS: Record<string, string> = {
  auto_faskes: 'bg-green-100 text-green-800',
  auto_kantor: 'bg-teal-100 text-teal-800',
  auto_user: 'bg-cyan-100 text-cyan-800',
  auto_tarif: 'bg-orange-100 text-orange-800',
  manual_required: 'bg-yellow-100 text-yellow-800',
  manual_optional: 'bg-slate-100 text-slate-600',
  calculated: 'bg-purple-100 text-purple-800',
}

const TIPE_LABELS: Record<string, string> = {
  auto_faskes: 'Auto Faskes',
  auto_kantor: 'Auto Kantor',
  auto_user: 'Auto User',
  auto_tarif: 'Auto Tarif',
  manual_required: 'Wajib Isi',
  manual_optional: 'Opsional',
  calculated: 'Sistem Hitung',
}

export function DraftingPKSView({ pipelineId, onGenerated }: Props) {
  const [data, setData] = useState<DraftingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [pksId, setPksId] = useState<string | null>(null)
  
  useEffect(() => {
    fetchDraftingData()
  }, [pipelineId])
  
  async function fetchDraftingData() {
    setLoading(true)
    try {
      const res = await fetch('/api/drafting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: pipelineId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      
      setData(d)
      
      // Initialize form values: auto-fill from auto_data, empty for manual
      const initial: Record<string, string> = {}
      for (const p of d.placeholders) {
        initial[p.key] = d.auto_data[p.key] || ''
      }
      setFormValues(initial)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  
  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/drafting/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: pipelineId, data_jsonb: formValues }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      
      setPksId(d.pks_id)
      
      if (d.can_submit) {
        toast.success('Draft tersimpan. Semua placeholder wajib sudah terisi. Siap generate!')
      } else {
        toast.warning(`Draft tersimpan. Masih ${d.missing_required.length} placeholder wajib belum diisi: ${d.missing_required.join(', ')}`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }
  
  async function handleGenerate() {
    setGenerating(true)
    try {
      // Save first
      await handleSave()
      
      // Trigger download .docx via Python mail merge (generate-docx endpoint)
      // Endpoint akan return binary .docx — browser auto-download
      const res = await fetch('/api/drafting/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pipeline_id: pipelineId,
          return_stats: false,  // binary download, bukan base64
        }),
      })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Network error' }))
        throw new Error(err.error || 'Gagal generate .docx')
      }
      
      // Read stats from headers
      const replaced = res.headers.get('X-Stats-Replaced') || '0'
      const empty = res.headers.get('X-Stats-Empty-Filled') || '0'
      const missing = res.headers.get('X-Stats-Missing') || '0'
      const structValid = res.headers.get('X-Stats-Structure-Valid') === 'true'
      
      // Trigger download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      a.download = filenameMatch ? filenameMatch[1] : `PKS_${Date.now()}.docx`
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      // Show stats as info
      toast.success(
        `✅ .docx berhasil di-download! Replaced: ${replaced}, Empty: ${empty}, Missing: ${missing}, Structure: ${structValid ? 'OK' : 'CHANGED'}`
      )
      
      // Show preview modal with info
      setPreviewHtml('downloaded')
      setPksId(pksId || pipelineId)
      onGenerated?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }
  
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  if (!data) return <div className="text-center py-12"><AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">Gagal memuat data drafting</p></div>
  
  const filledCount = Object.values(formValues).filter(v => v && v.trim()).length
  const totalCount = data.placeholders.length
  const progressPct = Math.round((filledCount / totalCount) * 100)
  
  // Group babs that have placeholders
  const babsWithPlaceholders = data.babs.filter(b => data.placeholder_by_bab[b.bab_id]?.length > 0)
  
  return (
    <div className="space-y-4">
      {/* Header + progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" /> Drafting PKS
              </h3>
              <p className="text-xs text-slate-500">
                Template: {data.template.nama} (v{data.template.version}) · {totalCount} placeholder
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-700">{progressPct}%</div>
              <div className="text-xs text-slate-500">{filledCount}/{totalCount} terisi</div>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-700 h-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge className="bg-green-100 text-green-800">{data.auto_count} Auto-fill</Badge>
            <Badge className="bg-yellow-100 text-yellow-800">{data.manual_required} Wajib Isi</Badge>
            <Badge className="bg-slate-100 text-slate-600">{data.manual_optional} Opsional</Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* Form per bab */}
      <div className="space-y-3">
        {babsWithPlaceholders.map(bab => (
          <Card key={bab.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400">#{bab.urutan}</span>
                {bab.bab_label}
                <Badge variant="outline" className="text-[10px]">{bab.bab_type}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.placeholder_by_bab[bab.bab_id] || []).map((p: Placeholder) => {
                const isAuto = p.tipe.startsWith('auto_')
                const isRequired = p.tipe === 'manual_required'
                const isFilled = formValues[p.key] && formValues[p.key].trim()
                
                return (
                  <div key={p.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <Label className="text-xs flex items-center gap-1">
                        <code className="font-mono text-[10px] text-slate-500">{`{{${p.key}}}`}</code>
                        <Badge className={`${TIPE_COLORS[p.tipe]} text-[9px]`}>{TIPE_LABELS[p.tipe]}</Badge>
                        {isRequired && !isFilled && <span className="text-red-500 text-[10px]">*</span>}
                      </Label>
                      {isAuto ? (
                        <div className="flex items-center gap-1 mt-1">
                          <Input 
                            value={formValues[p.key] || ''} 
                            onChange={e => setFormValues(f => ({ ...f, [p.key]: e.target.value }))}
                            className={`text-sm ${isFilled ? 'bg-green-50 border-green-200' : ''}`}
                            placeholder="Auto-fill dari database"
                          />
                          {isFilled && <Lock className="w-3 h-3 text-green-600 flex-shrink-0" />}
                        </div>
                      ) : (
                        <Input 
                          value={formValues[p.key] || ''} 
                          onChange={e => setFormValues(f => ({ ...f, [p.key]: e.target.value }))}
                          className={`text-sm ${isRequired && !isFilled ? 'border-yellow-300 bg-yellow-50' : isFilled ? 'bg-white' : ''}`}
                          placeholder={isRequired ? 'Wajib diisi...' : 'Opsional...'}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 sticky bottom-0 bg-white p-3 border-t border-slate-200">
        <Button variant="outline" onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Simpan Draft
        </Button>
        <Button className="bg-blue-700 hover:bg-blue-800 flex-1" onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
          Generate .docx (Mail Merge)
        </Button>
      </div>
      
      {/* Info banner */}
      <Alert className="bg-blue-50 border-blue-200">
        <FileText className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-900 text-sm">
          <strong>Mail Merge via Python:</strong> Tombol Generate akan download file .docx hasil mail merge.
          Format dokumen tidak akan bergeser 1mm pun — struktur XML identik dengan template.
          Buka file di Microsoft Word untuk review/edit, lalu upload kembali untuk submit ke CM.
        </AlertDescription>
      </Alert>
      
      {/* Preview modal (simplified — info only) */}
      {previewHtml && pksId && (
        <PreviewModal pksId={pksId} pipelineId={pipelineId} onClose={() => setPreviewHtml(null)} onSubmitted={() => { onGenerated?.(); fetchDraftingData(); }} />
      )}
    </div>
  )
}

function PreviewModal({ pksId, pipelineId, onClose, onSubmitted }: { pksId: string | null; pipelineId: string; onClose: () => void; onSubmitted?: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  const [pipelineInfo, setPipelineInfo] = useState<any>(null)

  useEffect(() => {
    fetchVersions()
    fetchPipelineInfo()
  }, [pipelineId])

  async function fetchVersions() {
    try {
      const res = await fetch(`/api/drafting/versions?pipeline_id=${pipelineId}`)
      const data = await res.json()
      if (res.ok) setVersions(data.data || [])
    } catch (e) { console.error(e) }
  }

  async function fetchPipelineInfo() {
    try {
      const res = await fetch(`/api/pipeline/detail/${pipelineId}`)
      const data = await res.json()
      if (res.ok) setPipelineInfo(data.data)
    } catch (e) { console.error(e) }
  }

  const currentIteration = pipelineInfo?.draft_iteration || 0
  const remainingIterations = 4 - currentIteration
  const lastReturnedVersion = versions.filter((v: any) => v.status === 'returned').pop()

  async function handleSubmitDraft() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/drafting/save-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: pipelineId,
          content_html: null,  // tidak pakai HTML lagi — pakai .docx yang sudah di-download
          char_counts: {},
          edit_reason: null,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message || 'Draft submitted ke CM')
      onSubmitted?.()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" /> .docx Berhasil Di-download
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Iteration info */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
            <div className="text-sm">
              <strong>Iterasi: {currentIteration}/4</strong>
              {remainingIterations > 0 ? ` (sisa ${remainingIterations}x koreksi sebelum CM takeover)` : ' — CM harus takeover'}
            </div>
            {lastReturnedVersion && (
              <Badge className="bg-yellow-100 text-yellow-800">Dikembalikan CM</Badge>
            )}
          </div>

          {/* CM feedback (if returned) */}
          {lastReturnedVersion?.cm_feedback && (
            <Alert className="bg-yellow-50 border-yellow-300">
              <AlertCircle className="w-4 h-4 text-yellow-700" />
              <AlertDescription className="text-yellow-900 text-sm">
                <strong>Catatan CM (v{lastReturnedVersion.version}):</strong> {lastReturnedVersion.cm_feedback}
              </AlertDescription>
            </Alert>
          )}

          {/* Info tentang workflow baru */}
          <Alert className="bg-blue-50 border-blue-200">
            <FileText className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-sm">
              <strong>Workflow Mail Merge:</strong>
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                <li>File <code>.docx</code> sudah ter-download ke komputer Anda (cek folder Downloads).</li>
                <li>Buka file di <strong>Microsoft Word</strong> untuk review/edit.</li>
                <li>Format <strong>tidak bergeser 1mm pun</strong> — struktur XML identik dengan template.</li>
                <li>Setelah review, klik <strong>Submit Draft ke CM</strong> di bawah.</li>
                <li>CM akan review .docx yang sama (atau Anda upload balik kalau ada revisi).</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <GenerateDocxButton
              pipelineId={pipelineId}
              label="Download .docx Lagi"
              variant="outline"
              showStats={false}
            />
            <Button
              className="bg-green-700 hover:bg-green-800 flex-1"
              onClick={handleSubmitDraft}
              disabled={submitting || remainingIterations <= 0}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Submit Draft v{currentIteration + 1} ke CM
            </Button>
          </div>

          {/* Version history */}
          {versions.length > 0 && (
            <div className="border border-slate-200 rounded p-3">
              <div className="text-sm font-semibold mb-2">History Versions</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {versions.map((v: any) => (
                  <div key={v.id} className="text-xs flex items-center gap-2 border-b border-slate-100 pb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {v.version_label === 'final' ? 'FINAL' : `v${v.version}`}
                    </Badge>
                    <span className={v.status === 'returned' ? 'text-yellow-700' : v.status === 'approved' || v.status === 'final' ? 'text-green-700' : 'text-slate-600'}>
                      {v.status}
                    </span>
                    <span className="text-slate-400 ml-auto">
                      {new Date(v.edited_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
