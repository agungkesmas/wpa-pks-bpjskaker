'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Upload, Download, FileText, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export interface BatchImportResult {
  success: boolean
  total_processed: number
  total_success: number
  total_error: number
  errors: Array<{ row: number; message: string }>
  created_ids?: string[]
  message?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  templateUrl: string
  importUrl: string
  entityName: string  // "kantor" atau "user"
  columns: Array<{ key: string; label: string; required?: boolean }>
  onSuccess?: (result: BatchImportResult) => void
}

export function BatchImportDialog({
  open,
  onOpenChange,
  title,
  templateUrl,
  importUrl,
  entityName,
  columns,
  onSuccess,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setPreview(null)
    setParseError(null)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  async function handleDownloadTemplate() {
    try {
      const res = await fetch(templateUrl)
      if (!res.ok) throw new Error('Gagal download template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `template-${entityName}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Template berhasil di-download')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    if (!selectedFile.name.match(/\.xlsx$/i)) {
      toast.error('File harus .xlsx')
      return
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file melebihi 5MB')
      return
    }
    setFile(selectedFile)
    setPreview(null)
    setParseError(null)
    setImportResult(null)

    // Parse Excel di client untuk preview
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      setPreview(rows.slice(0, 10)) // Preview 10 row pertama
    } catch (e: any) {
      setParseError('Gagal parse Excel: ' + e.message)
    }
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(importUrl, {
        method: 'POST',
        body: formData,
      })
      const data: BatchImportResult = await res.json()
      if (!res.ok) throw new Error(data.message || data.errors?.[0]?.message || 'Import gagal')

      setImportResult(data)
      toast.success(data.message || `Berhasil import ${data.total_success} ${entityName}`)
      if (onSuccess) onSuccess(data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalPreviewRows = preview?.length || 0
  const hasValidData = preview && preview.length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> {title}
          </DialogTitle>
        </DialogHeader>

        {importResult ? (
          // Hasil Import
          <div className="space-y-4">
            <div className={`p-4 rounded border ${importResult.success ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {importResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
                <span className="font-semibold text-slate-900">
                  {importResult.success ? 'Import Berhasil' : 'Import Selesai dengan Error'}
                </span>
              </div>
              <div className="text-sm text-slate-700 space-y-1">
                <div>Total diproses: <strong>{importResult.total_processed}</strong></div>
                <div>Berhasil: <strong className="text-green-700">{importResult.total_success}</strong></div>
                {importResult.total_error > 0 && (
                  <div>Gagal: <strong className="text-red-700">{importResult.total_error}</strong></div>
                )}
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="border border-red-200 rounded p-3 bg-red-50/50">
                <div className="text-sm font-semibold text-red-800 mb-2">Detail Error:</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-700">
                      Row {err.row}: {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.success && importResult.created_ids && importResult.created_ids.length > 0 && entityName === 'user' && (
              <Button
                className="w-full bg-green-700 hover:bg-green-800"
                onClick={() => {
                  const ids = importResult.created_ids!.join(',')
                  window.open(`/api/print/slip-kredensial?user_ids=${ids}`, '_blank')
                }}
              >
                <Download className="w-4 h-4 mr-2" /> Print Semua Kredensial ({importResult.created_ids.length})
              </Button>
            )}

            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="w-full">Selesai</Button>
            </DialogFooter>
          </div>
        ) : (
          // Form Upload
          <div className="space-y-4">
            {/* Step 1: Download Template */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">1. Download Template Excel</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="w-3 h-3 mr-1" /> Download Template
                </Button>
                <span className="text-xs text-slate-500">Format .xlsx</span>
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap gap-1">
                Kolom: {columns.map(c => (
                  <Badge key={c.key} variant="outline" className="text-[10px]">
                    {c.label}{c.required && <span className="text-red-600 ml-0.5">*</span>}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Step 2: Upload File */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">2. Upload File Excel</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileSelect}
                className="block w-full text-sm text-slate-500
                  file:mr-3 file:py-2 file:px-4 file:rounded file:border-0
                  file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100 cursor-pointer"
              />
              {file && (
                <div className="text-xs text-slate-600 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
              {parseError && (
                <Alert className="bg-red-50 border-red-200">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-900 text-xs">{parseError}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Step 3: Preview */}
            {hasValidData && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">3. Preview Data (10 row pertama)</Label>
                <div className="border border-slate-200 rounded overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        {columns.map(c => (
                          <th key={c.key} className="p-2 text-left">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview!.map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-2 text-slate-400">{i + 1}</td>
                          {columns.map(c => (
                            <td key={c.key} className="p-2">{String(row[c.key] || row[c.label] || '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-slate-500">
                  Menampilkan {totalPreviewRows} row{totalPreviewRows >= 10 && ' (mungkin ada lebih)'}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Batal</Button>
              <Button
                disabled={!hasValidData || loading}
                onClick={handleImport}
                className="bg-blue-700 hover:bg-blue-800"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4 mr-1" /> Import {entityName === 'user' ? 'User' : 'Kantor'}</>}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
