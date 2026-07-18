'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Download, FileText, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

// ============================================================
// GenerateDocxButton
// ============================================================
// Tombol untuk generate PKS .docx via Python mail merge.
//
// Cara pakai:
//   <GenerateDocxButton pipelineId={pipeline.id} />
//   <GenerateDocxButton data={{NAMA_FASKES: "RS Test", ...}} />
//
// Flow:
// 1. User klik tombol
// 2. POST /api/drafting/generate-docx dengan {pipeline_id} atau {data}
// 3. Server spawn Python pks_merge.py → return binary .docx
// 4. Browser auto-download .docx
// 5. Optional: tampilkan stats (replaced/empty/missing) sebagai info
// ============================================================

interface Props {
  pipelineId?: string
  data?: Record<string, any>
  label?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showStats?: boolean  // kalau true, tampilkan modal stats setelah generate
  className?: string
}

interface MergeStats {
  replaced: number
  empty_filled: number
  missing_data: number
  missing_tokens: string[]
  structure_valid: boolean
  structure_diff: Record<string, number>
}

export function GenerateDocxButton({
  pipelineId,
  data,
  label = 'Generate .docx',
  variant = 'default',
  size = 'default',
  showStats = true,
  className,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<MergeStats | null>(null)
  const [showModal, setShowModal] = useState(false)

  async function handleGenerate() {
    if (!pipelineId && !data) {
      toast.error('Butuh pipelineId atau data untuk generate')
      return
    }

    setLoading(true)
    setStats(null)

    try {
      // Pakai mode return_stats=true untuk dapat stats + base64 file
      const res = await fetch('/api/drafting/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pipeline_id: pipelineId,
          data: data,
          return_stats: true,  // biar dapat stats
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Network error' }))
        toast.error(err.error || 'Gagal generate .docx')
        return
      }

      const json = await res.json()

      if (!json.ok) {
        toast.error(json.error || 'Gagal generate .docx')
        return
      }

      // Set stats untuk modal
      setStats(json.stats)

      // Download file dari base64
      const blob = base64ToBlob(json.file_base64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = json.filename || 'PKS.docx'
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`✅ ${json.filename} berhasil di-download`)

      if (showStats && json.stats) {
        setShowModal(true)
      }
    } catch (e: any) {
      console.error('Generate error:', e)
      toast.error(e.message || 'Gagal generate .docx')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleGenerate}
        disabled={loading}
        variant={variant}
        size={size}
        className={className}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {label}
      </Button>

      {/* Stats Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Statistik Mail Merge
            </DialogTitle>
            <DialogDescription>
              Hasil generate .docx via Python (pks_merge.py). Format tidak bergeser 1mm pun —
              struktur XML identik dengan template.
            </DialogDescription>
          </DialogHeader>

          {stats && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Replaced" value={stats.replaced - stats.empty_filled} color="green" />
                <StatCard label="Empty → ___" value={stats.empty_filled} color="yellow" />
                <StatCard label="Missing" value={stats.missing_data} color="red" />
                <StatCard
                  label="Structure"
                  value={stats.structure_valid ? '✓ OK' : '✗ CHANGED'}
                  color={stats.structure_valid ? 'green' : 'red'}
                />
              </div>

              {/* Structure diff */}
              <div className="border rounded p-3 bg-slate-50">
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  Structure Validation (harus 0 semua)
                </div>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {Object.entries(stats.structure_diff).map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-slate-500">{k.replace(/_/g, ' ')}</span>
                      <Badge variant="outline" className={v === 0 ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}>
                        {v > 0 ? '+' : ''}{v}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing tokens */}
              {stats.missing_tokens && stats.missing_tokens.length > 0 ? (
                <div className="border border-yellow-300 bg-yellow-50 rounded p-3">
                  <div className="text-xs font-semibold text-yellow-800 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {stats.missing_tokens.length} placeholder tidak punya data:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {stats.missing_tokens.map(t => (
                      <code key={t} className="text-xs bg-yellow-100 px-1.5 py-0.5 rounded">
                        {'{{' + t + '}}'}
                      </code>
                    ))}
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    Placeholder ini dibiarkan apa adanya ({'{{...}}'}) di dokumen. Isi data sebelum generate untuk hasil lengkap.
                  </p>
                </div>
              ) : (
                <div className="border border-green-300 bg-green-50 rounded p-3">
                  <div className="text-sm text-green-800 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    ✅ Semua placeholder terisi! Tidak ada {'{{...}}'} tersisa di dokumen.
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="text-xs text-slate-500 border-t pt-3">
                <p>
                  <strong>Cara edit:</strong> Buka file .docx di Microsoft Word. Format tidak akan bergeser
                  karena Python hanya mengganti teks di dalam <code>&lt;w:t&gt;</code> element —
                  struktur XML (paragraph, table, run) identik dengan template.
                </p>
                <p className="mt-1">
                  <strong>Submit ke CM:</strong> Setelah edit di Word, upload kembali file .docx ke aplikasi
                  untuk review CM (atau pakai tombol Submit Draft jika sudah final).
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================
// Helper: base64 → Blob
// ============================================================
function base64ToBlob(base64: string, mime: string): Blob {
  const byteChars = atob(base64)
  const sliceSize = 8192
  const byteArrays: ArrayBuffer[] = []
  for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
    const slice = byteChars.slice(offset, offset + sliceSize)
    const buffer = new ArrayBuffer(slice.length)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < slice.length; i++) {
      view[i] = slice.charCodeAt(i)
    }
    byteArrays.push(buffer)
  }
  return new Blob(byteArrays, { type: mime })
}

// ============================================================
// StatCard sub-component
// ============================================================
function StatCard({ label, value, color }: { label: string; value: number | string; color: 'green' | 'yellow' | 'red' | 'blue' }) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  return (
    <div className={`border rounded p-3 ${colorClasses[color]}`}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
}
