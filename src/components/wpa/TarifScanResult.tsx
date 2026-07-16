'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Scan, CheckCircle2, XCircle, AlertCircle, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

interface ScanResult {
  summary: {
    total: number
    wajar: number
    perlu_review: number
    tidak_wajar: number
    no_acuan: number
    sama_pks_lama: number
    berubah_pks_lama: number
    baru: number
    auto_approve: boolean
  }
  detail: Array<{
    nama_item: string
    tarif_diajukan: number
    satuan: string
    kategori: string
    acuan_nama: string | null
    tarif_acuan: number | null
    selisih: number | null
    selisih_pct: number | null
    status_kewajaran: string
    pks_lama_status: string
    pks_lama_tarif: number | null
    pks_lama_delta: number | null
  }>
  file_name: string
  auto_approve: boolean
}

interface Props {
  pipelineId: string
  onApprove?: () => void
  onReturn?: () => void
}

export function TarifScanResult({ pipelineId, onApprove, onReturn }: Props) {
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [aiReview, setAiReview] = useState<string | null>(null)

  async function handleScan() {
    setLoading(true)
    setResult(null)
    setAiReview(null)
    try {
      const res = await fetch(`/api/tarif/scan?pipeline_id=${pipelineId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      toast.success(`Scan selesai: ${data.summary.total} item, ${data.summary.tidak_wajar} tidak wajar`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAIReview() {
    if (!result) return
    setAiLoading(true)
    try {
      const res = await fetch(`/api/tarif/ai-review?pipeline_id=${pipelineId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: result.summary, detail: result.detail })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAiReview(data.text)
      toast.success(`AI Review (${data.provider})`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const formatRp = (n: number | null) => n !== null ? `Rp ${n.toLocaleString('id-ID')}` : '-'
  const formatPct = (n: number | null) => n !== null ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '-'

  return (
    <div className="space-y-4">
      {/* Scan button */}
      {!result && (
        <Card>
          <CardContent className="p-6 text-center">
            <Scan className="w-10 h-10 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">Scan Tarif</h3>
            <p className="text-sm text-slate-500 mb-4">
              Parse Excel tarif dari PIC RS + compare dengan Bank Tarif acuan + compare dengan PKS lama.
            </p>
            <Button onClick={handleScan} disabled={loading} className="bg-blue-700 hover:bg-blue-800">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...</> : <><Scan className="w-4 h-4 mr-2" /> Scan Tarif Sekarang</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {result && (
        <>
          {result.auto_approve && (
            <Alert className="bg-green-50 border-green-300">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-900 text-sm">
                <strong>AUTO-APPROVE:</strong> Semua {result.summary.total} item tarif SAMA dengan PKS lama dan tidak ada yang tidak wajar. Tarif bisa langsung di-approve.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Summary Scan ({result.file_name})</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                <div className="text-center p-2 bg-slate-50 rounded">
                  <div className="text-xl font-bold text-slate-900">{result.summary.total}</div>
                  <div className="text-[10px] text-slate-500">Total Item</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="text-xl font-bold text-green-700">{result.summary.wajar}</div>
                  <div className="text-[10px] text-slate-500">✅ Wajar</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="text-xl font-bold text-yellow-700">{result.summary.perlu_review}</div>
                  <div className="text-[10px] text-slate-500">⚠️ Review</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="text-xl font-bold text-red-700">{result.summary.tidak_wajar}</div>
                  <div className="text-[10px] text-slate-500">❌ Tdk Wajar</div>
                </div>
                <div className="text-center p-2 bg-slate-100 rounded">
                  <div className="text-xl font-bold text-slate-600">{result.summary.no_acuan}</div>
                  <div className="text-[10px] text-slate-500">⚪ No Acuan</div>
                </div>
              </div>

              {/* PKS lama comparison */}
              <div className="mt-3 flex gap-2 flex-wrap">
                {result.summary.sama_pks_lama > 0 && (
                  <Badge className="bg-green-100 text-green-800">🟢 {result.summary.sama_pks_lama} sama PKS lama</Badge>
                )}
                {result.summary.berubah_pks_lama > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-800">🟡 {result.summary.berubah_pks_lama} berubah dari PKS lama</Badge>
                )}
                {result.summary.baru > 0 && (
                  <Badge className="bg-blue-100 text-blue-800">🔵 {result.summary.baru} item baru</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detail table */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Detail per Item</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left p-2">Nama Item</th>
                      <th className="text-right p-2">Diajukan</th>
                      <th className="text-right p-2">Acuan</th>
                      <th className="text-right p-2">Delta</th>
                      <th className="text-center p-2">Status</th>
                      <th className="text-center p-2">PKS Lama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.detail.map((d, i) => (
                      <tr key={i} className={`border-b ${d.status_kewajaran === 'TIDAK_WAJAR' ? 'bg-red-50' : d.status_kewajaran === 'PERLU_REVIEW' ? 'bg-yellow-50' : ''}`}>
                        <td className="p-2">{d.nama_item}</td>
                        <td className="text-right p-2 font-mono">{formatRp(d.tarif_diajukan)}</td>
                        <td className="text-right p-2 font-mono text-slate-500">{d.tarif_acuan ? formatRp(d.tarif_acuan) : '-'}</td>
                        <td className={`text-right p-2 font-mono ${d.selisih_pct !== null && Math.abs(d.selisih_pct) > 20 ? 'text-red-700 font-bold' : d.selisih_pct !== null && Math.abs(d.selisih_pct) > 5 ? 'text-yellow-700' : 'text-green-700'}`}>
                          {formatPct(d.selisih_pct)}
                        </td>
                        <td className="text-center p-2">
                          {d.status_kewajaran === 'WAJAR' && <span className="text-green-600">✅</span>}
                          {d.status_kewajaran === 'PERLU_REVIEW' && <span className="text-yellow-600">⚠️</span>}
                          {d.status_kewajaran === 'TIDAK_WAJAR' && <span className="text-red-600">❌</span>}
                          {d.status_kewajaran === 'NO_ACUAN' && <span className="text-slate-400">⚪</span>}
                        </td>
                        <td className="text-center p-2">
                          {d.pks_lama_status === 'SAMA' && <span className="text-green-600 text-[10px]">Sama</span>}
                          {d.pks_lama_status === 'BERUBAH' && <span className="text-yellow-600 text-[10px]">{d.pks_lama_delta! > 0 ? '+' : ''}{formatRp(d.pks_lama_delta)}</span>}
                          {d.pks_lama_status === 'BARU' && <span className="text-blue-600 text-[10px]">Baru</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* AI Review (opsional) */}
          {!aiReview ? (
            <Button variant="outline" onClick={handleAIReview} disabled={aiLoading}>
              {aiLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI menganalisis...</> : <><Sparkles className="w-4 h-4 mr-2" /> Minta AI Review (opsional)</>}
            </Button>
          ) : (
            <Card className="border-purple-200 bg-purple-50/30">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-600" /> AI Review</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-sm whitespace-pre-wrap text-slate-700">{aiReview}</pre>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 sticky bottom-0 bg-white p-3 border-t">
            <Button className="bg-green-700 hover:bg-green-800 flex-1" onClick={onApprove}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> OK, Lanjut ke Kredensialing
            </Button>
            <Button className="bg-yellow-600 hover:bg-yellow-700 flex-1" onClick={onReturn}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Return ke PIC RS
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
