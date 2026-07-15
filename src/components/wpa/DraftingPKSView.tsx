'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Save, FileText, CheckCircle2, AlertCircle, Lock, Sparkles, Printer } from 'lucide-react'
import { toast } from 'sonner'

// Lazy load DocumentEditor (TipTap ~500KB) — hanya saat user edit dokumen
const DocumentEditor = dynamic(
  () => import('@/components/wpa/DocumentEditor').then(m => ({ default: m.DocumentEditor })),
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
      
      // Generate
      const res = await fetch('/api/drafting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: pipelineId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      
      setPreviewHtml(d.html)
      setPksId(d.pks_id)
      toast.success(`PKS berhasil di-generate! Hash: ${d.hash}. Sisa placeholder kosong: ${d.remaining_placeholders}`)
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
          {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Generate & Preview
        </Button>
      </div>
      
      {/* Preview modal */}
      {previewHtml && (
        <PreviewModal html={previewHtml} pksId={pksId} onClose={() => setPreviewHtml(null)} />
      )}
    </div>
  )
}

function PreviewModal({ html, pksId, onClose }: { html: string; pksId: string | null; onClose: () => void }) {
  const [showEditor, setShowEditor] = useState(false)
  
  function handlePrint() {
    const printWindow = window.open('', '_blank', 'width=800,height=900')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
      <title>Preview PKS — Mitra PLKK</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #000; padding: 4px 8px; }
      </style>
      </head><body>${html}</body></html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.focus(); printWindow.print() }, 500)
  }
  
  if (showEditor && pksId) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editor PKS (Free Edit)</DialogTitle></DialogHeader>
          <DocumentEditor dokumenId={pksId} onClose={onClose} />
        </DialogContent>
      </Dialog>
    )
  }
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" /> Preview PKS
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="bg-blue-700 hover:bg-blue-800">
              <Printer className="w-4 h-4 mr-1" /> Print / PDF
            </Button>
            {pksId && (
              <Button variant="outline" onClick={() => setShowEditor(true)}>
                <FileText className="w-4 h-4 mr-1" /> Edit di WYSIWYG
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>Tutup</Button>
          </div>
          <div 
            className="border border-slate-200 rounded-lg p-6 overflow-y-auto bg-white"
            style={{ maxHeight: '60vh', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
