'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Upload, Download, FileText, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ImportResult {
  success: boolean
  message: string
  total_processed: number
  total_success: number
  total_error: number
  stats?: {
    totalFaskesCreated: number
    totalFaskesUpdated: number
    totalPksCreated: number
    totalPksUpdated: number
    totalPicRsCreated: number
    totalPicRsSkipped: number
  }
  results?: Array<{ row: number; faskes: string; status: string; pic_rs_password?: string }>
  errors?: Array<{ row: number; message: string }>
}

export function FaskesBatchImport() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/faskes/batch-import', { method: 'POST', body: formData })
      const data: ImportResult = await res.json()
      if (!res.ok) throw new Error(data.message || data.errors?.[0]?.message || 'Import gagal')
      setResult(data)
      toast.success(data.message)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleClose(o: boolean) {
    setOpen(o)
    if (!o) { setFile(null); setResult(null) }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="bg-blue-700 hover:bg-blue-800"><Upload className="w-4 h-4 mr-2" /> Import Batch</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Import Batch Faskes</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className={`p-4 rounded border ${result.success ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-yellow-600" />}
                <span className="font-semibold">{result.success ? 'Import Berhasil' : 'Import Selesai'}</span>
              </div>
              <div className="text-sm text-slate-700">{result.message}</div>
            </div>

            {result.stats && (
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-blue-50 rounded text-center">
                  <div className="text-lg font-bold text-blue-700">{result.stats.totalFaskesCreated}</div>
                  <div className="text-[10px] text-slate-500">Faskes Baru</div>
                </div>
                <div className="p-2 bg-teal-50 rounded text-center">
                  <div className="text-lg font-bold text-teal-700">{result.stats.totalFaskesUpdated}</div>
                  <div className="text-[10px] text-slate-500">Faskes Updated</div>
                </div>
                <div className="p-2 bg-green-50 rounded text-center">
                  <div className="text-lg font-bold text-green-700">{result.stats.totalPksCreated}</div>
                  <div className="text-[10px] text-slate-500">PKS Baru</div>
                </div>
                <div className="p-2 bg-cyan-50 rounded text-center">
                  <div className="text-lg font-bold text-cyan-700">{result.stats.totalPksUpdated}</div>
                  <div className="text-[10px] text-slate-500">PKS Updated</div>
                </div>
                <div className="p-2 bg-purple-50 rounded text-center">
                  <div className="text-lg font-bold text-purple-700">{result.stats.totalPicRsCreated}</div>
                  <div className="text-[10px] text-slate-500">PIC RS Baru</div>
                </div>
                <div className="p-2 bg-slate-50 rounded text-center">
                  <div className="text-lg font-bold text-slate-600">{result.stats.totalPicRsSkipped}</div>
                  <div className="text-[10px] text-slate-500">PIC RS Skipped</div>
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="border border-red-200 rounded p-3 bg-red-50/50">
                <div className="text-sm font-semibold text-red-800 mb-2">Detail Error ({result.errors.length}):</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-700">Row {err.row}: {err.message}</div>
                  ))}
                </div>
              </div>
            )}

            {/* PIC RS credentials (kalau ada yang baru created) */}
            {result.results?.some(r => r.pic_rs_password) && (
              <Alert className="bg-yellow-50 border-yellow-300">
                <AlertCircle className="w-4 h-4 text-yellow-700" />
                <AlertDescription className="text-yellow-900 text-xs">
                  <strong>Password PIC RS:</strong> Catat password di bawah dan berikan ke PIC RS masing-masing:
                  {result.results.filter(r => r.pic_rs_password).map((r, i) => (
                    <div key={i} className="mt-1 font-mono text-[11px]">{r.faskes}: <code className="bg-white px-1 rounded">{r.pic_rs_password}</code></div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <Button className="w-full" onClick={() => handleClose(false)}>Selesai</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-700" />
              <AlertDescription className="text-blue-900 text-xs">
                <strong>Template:</strong> Data faskes + PKS + PIC RS (opsional). Kalau faskes/PKS sudah ada → auto-update. PIC RS auto-create kalau email diisi.
              </AlertDescription>
            </Alert>

            <div>
              <Label>1. Download Template</Label>
              <a href="/api/faskes/template" target="_blank" className="block mt-1">
                <Button variant="outline" size="sm"><Download className="w-3 h-3 mr-1" /> Download Template Excel</Button>
              </a>
            </div>

            <div>
              <Label>2. Upload File</Label>
              <input
                type="file"
                accept=".xlsx"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && <div className="text-xs text-slate-600 mt-1 flex items-center gap-1"><FileText className="w-3 h-3" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
            </div>

            <Button onClick={handleImport} disabled={!file || loading} className="w-full bg-blue-700 hover:bg-blue-800">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4 mr-2" /> Import Faskes</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
