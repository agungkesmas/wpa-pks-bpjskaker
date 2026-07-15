'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload, FileText, CheckCircle2, XCircle, X, Info } from 'lucide-react'
import { toast } from 'sonner'
import { DOKUMEN_REQUIREMENTS, type DokumenRequirement } from '@/lib/wpa-constants'

interface UploadedFile {
  id: string
  jenis: string
  file_name: string
  file_url: string
  file_size: number
  mime_type: string | null
  uploaded_at: string
}

interface Props {
  jenisPipeline: string
  pipelineId?: string
  faskesId?: string
  initialFiles?: UploadedFile[]
  readOnly?: boolean  // true = display only (no upload), for view-only access
  onFilesChange?: (uploadedJenisList: string[]) => void
}

export function FileUploader({
  jenisPipeline,
  pipelineId,
  faskesId,
  initialFiles = [],
  readOnly = false,
  onFilesChange,
}: Props) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(initialFiles)
  const [uploadingJenis, setUploadingJenis] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const requirements = DOKUMEN_REQUIREMENTS[jenisPipeline] || []

  // Map of jenis → uploaded file (latest)
  const uploadedByJenis: Record<string, UploadedFile> = {}
  uploadedFiles.forEach(f => {
    uploadedByJenis[f.jenis] = f
  })

  const uploadedJenisList = Object.keys(uploadedByJenis)
  const allComplete = requirements.length > 0 && requirements.every(r => uploadedByJenis[r.jenis])

  // Notify parent of changes
  const notifyChange = useCallback((files: UploadedFile[]) => {
    if (onFilesChange) {
      const jenisSet = new Set(files.map(f => f.jenis))
      onFilesChange(Array.from(jenisSet))
    }
  }, [onFilesChange])

  async function handleUpload(req: DokumenRequirement, file: File) {
    if (!pipelineId && !faskesId) {
      toast.error('Pipeline atau faskes ID tidak ditemukan')
      return
    }

    // Validate file type
    const allowedExtensions = req.accept.split(',').map(e => e.trim().toLowerCase())
    const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (!allowedExtensions.includes(fileExt)) {
      toast.error(`File harus ${req.accept}`)
      return
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file melebihi 10MB')
      return
    }

    setUploadingJenis(req.jenis)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('jenis', req.jenis)
      if (pipelineId) formData.append('pipeline_id', pipelineId)
      if (faskesId) formData.append('faskes_id', faskesId)

      const res = await fetch('/api/pengajuan-dokumen/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Replace if same jenis already uploaded
      const newFiles = [
        ...uploadedFiles.filter(f => f.jenis !== req.jenis),
        data.data,
      ]
      setUploadedFiles(newFiles)
      notifyChange(newFiles)
      toast.success(`${req.label} berhasil diupload`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploadingJenis(null)
      // Reset input so same file can be re-selected
      if (fileInputRefs.current[req.jenis]) {
        fileInputRefs.current[req.jenis]!.value = ''
      }
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  if (requirements.length === 0) {
    return (
      <Alert className="bg-slate-50 border-slate-200">
        <Info className="w-4 h-4 text-slate-500" />
        <AlertDescription className="text-slate-600">
          Tidak ada file wajib untuk jenis pengajuan ini.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
        <div className="text-sm">
          <strong className="text-slate-900">{uploadedJenisList.length}</strong>
          <span className="text-slate-500"> / {requirements.length} file terunggah</span>
        </div>
        {allComplete ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Lengkap
          </Badge>
        ) : (
          <Badge className="bg-yellow-100 text-yellow-800">
            {requirements.length - uploadedJenisList.length} file lagi
          </Badge>
        )}
      </div>

      {/* File rows */}
      <div className="space-y-2">
        {requirements.map(req => {
          const uploaded = uploadedByJenis[req.jenis]
          const isUploading = uploadingJenis === req.jenis
          return (
            <Card key={req.jenis} className={uploaded ? 'border-green-300 bg-green-50/30' : 'border-slate-200'}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {uploaded ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-semibold text-sm text-slate-900">
                          {req.label}
                          {req.wajib && <span className="text-red-600 ml-1">*</span>}
                        </div>
                        <div className="text-xs text-slate-500">{req.description}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {uploaded ? (
                          <>
                            <a
                              href={uploaded.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-700 hover:underline truncate max-w-[200px]"
                            >
                              {uploaded.file_name}
                            </a>
                            <Badge variant="outline" className="text-[10px]">{formatBytes(uploaded.file_size)}</Badge>
                            {!readOnly && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isUploading}
                                onClick={() => fileInputRefs.current[req.jenis]?.click()}
                              >
                                Ganti
                              </Button>
                            )}
                          </>
                        ) : readOnly ? (
                          <Badge variant="outline" className="text-slate-400">Belum diupload</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUploading}
                            onClick={() => fileInputRefs.current[req.jenis]?.click()}
                          >
                            {isUploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Format: {req.accept} · Maks 10MB
                    </div>
                  </div>
                  <input
                    ref={(el) => { fileInputRefs.current[req.jenis] = el }}
                    type="file"
                    accept={req.accept}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload(req, f)
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!allComplete && !readOnly && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <Info className="w-4 h-4 text-yellow-700" />
          <AlertDescription className="text-yellow-900">
            Semua file wajib harus diupload sebelum pengajuan bisa dikirim.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
