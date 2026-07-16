'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Edit3, Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  pipelineId: string
  onTakeoverComplete?: () => void
}

export function CMTakeoverModal({ pipelineId, onTakeoverComplete }: Props) {
  const [mode, setMode] = useState<'system_edit' | 'file_upload' | null>(null)
  const [contentHtml, setContentHtml] = useState('')
  const [editReason, setEditReason] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('jenis', 'pks_final')
      formData.append('pipeline_id', pipelineId)

      const res = await fetch('/api/pengajuan-dokumen/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setFileUrl(data.data.file_url)
      setFileName(data.data.file_name)
      toast.success('File berhasil di-upload')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (mode === 'system_edit' && contentHtml.length < 10) {
      toast.error('Content HTML wajib diisi untuk system_edit mode')
      return
    }
    if (mode === 'file_upload' && !fileUrl) {
      toast.error('File final wajib di-upload untuk file_upload mode')
      return
    }

    setSubmitting(true)
    try {
      const body: any = {
        pipeline_id: pipelineId,
        takeover_mode: mode,
      }
      if (mode === 'system_edit') {
        body.content_html = contentHtml
        body.edit_reason = editReason || 'CM takeover (edit di sistem)'
      } else {
        body.final_file_url = fileUrl
        body.final_file_name = fileName
        body.edit_reason = editReason || 'CM takeover (upload file final)'
      }

      const res = await fetch('/api/drafting/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success(data.message)
      onTakeoverComplete?.()
      window.location.reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Alert className="bg-orange-50 border-orange-300">
        <AlertCircle className="w-4 h-4 text-orange-700" />
        <AlertDescription className="text-orange-900 text-sm">
          <strong>⚠️ CM Takeover Diperlukan</strong>
          <br />
          PIC RS sudah 4x koreksi tapi draft masih return. Anda (CM) harus takeover draft ini.
          Pilih mode: edit di sistem (TipTap) ATAU upload file Word/PDF final.
        </AlertDescription>
      </Alert>

      {/* Mode selection */}
      {!mode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card
            className="cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
            onClick={() => setMode('system_edit')}
          >
            <CardContent className="p-6 text-center">
              <Edit3 className="w-10 h-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-sm mb-1">Edit di Sistem</h3>
              <p className="text-xs text-slate-500">
                Edit HTML langsung di editor (textarea). Hasil langsung jadi final.
              </p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-all"
            onClick={() => setMode('file_upload')}
          >
            <CardContent className="p-6 text-center">
              <Upload className="w-10 h-10 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold text-sm mb-1">Upload File Final</h3>
              <p className="text-xs text-slate-500">
                Upload file Word/PDF yang sudah final. PIC RS akan download + print.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System edit mode */}
      {mode === 'system_edit' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-600" /> Edit Draft Final di Sistem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Content HTML Final *</Label>
              <Textarea
                value={contentHtml}
                onChange={e => setContentHtml(e.target.value)}
                rows={10}
                placeholder="Paste atau ketik HTML final di sini..."
                className="font-mono text-xs"
              />
              <p className="text-xs text-slate-500 mt-1">
                Anda bisa copy HTML dari editor lain dan paste di sini.
              </p>
            </div>
            <div>
              <Label>Catatan (opsional)</Label>
              <Textarea
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                rows={2}
                placeholder="Catatan untuk PIC RS..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode(null)}>← Ganti Mode</Button>
              <Button
                className="bg-blue-700 hover:bg-blue-800 flex-1"
                disabled={submitting || contentHtml.length < 10}
                onClick={handleSubmit}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
                Submit Final Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File upload mode */}
      {mode === 'file_upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-600" /> Upload File Final
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>File Final (Word/PDF) *</Label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFileUpload(f)
                }}
                className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
              {uploading && <p className="text-xs text-slate-500 mt-1"><Loader2 className="w-3 h-3 inline animate-spin" /> Uploading...</p>}
              {fileName && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                  ✅ {fileName} berhasil di-upload
                </div>
              )}
            </div>
            <div>
              <Label>Catatan (opsional)</Label>
              <Textarea
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                rows={2}
                placeholder="Catatan untuk PIC RS..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode(null)}>← Ganti Mode</Button>
              <Button
                className="bg-purple-700 hover:bg-purple-800 flex-1"
                disabled={submitting || !fileUrl}
                onClick={handleSubmit}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Submit Final Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
