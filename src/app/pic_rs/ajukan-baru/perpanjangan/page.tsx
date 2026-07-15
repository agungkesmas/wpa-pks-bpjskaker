'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, ArrowLeft, RefreshCw, Info, FileText, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { FileUploader } from '@/components/wpa/FileUploader'

export default function PerpanjanganPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pksList, setPksList] = useState<any[]>([])
  const [selectedPksId, setSelectedPksId] = useState('')
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const [fetchingPks, setFetchingPks] = useState(true)
  const [allFilesUploaded, setAllFilesUploaded] = useState(false)

  useEffect(() => {
    fetchPks()
  }, [])

  async function fetchPks() {
    try {
      const res = await fetch('/api/pks/aktif')
      if (res.ok) {
        const data = await res.json()
        setPksList(data.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setFetchingPks(false)
    }
  }

  async function handleCreateDraft() {
    if (!selectedPksId) {
      toast.error('Pilih PKS yang akan diperpanjang')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/pengajuan-draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis: 'perpanjangan',
          pks_id: selectedPksId,
          catatan,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPipelineId(data.pipeline_id)
      toast.success('Draft pipeline dibuat. Silakan upload file wajib.')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!pipelineId) {
      toast.error('Buat draft dulu')
      return
    }
    if (!allFilesUploaded) {
      toast.error('Semua file wajib belum diupload')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/pengajuan-draft/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: pipelineId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
      router.push('/pic_rs/pengajuan')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Kembali
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-blue-600" />
          Perpanjangan PKS
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          PKS aktif yang akan berakhir (≤3 bulan). Upload 2 file wajib + kirim ke CM.
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-700" />
        <AlertDescription className="text-blue-900">
          <strong>Alur:</strong> Pilih PKS → Buat draft → Upload 2 file wajib → Submit ke CM → CM review.
        </AlertDescription>
      </Alert>

      {/* Step 1: Pilih PKS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A. Pilih PKS yang Akan Diperpanjang</CardTitle>
        </CardHeader>
        <CardContent>
          {fetchingPks ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : pksList.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Tidak ada PKS aktif yang dapat diperpanjang</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pksList.map(pks => {
                const daysLeft = pks.tanggal_berakhir ? Math.ceil((new Date(pks.tanggal_berakhir).getTime() - Date.now()) / 86400000) : null
                const isSelected = selectedPksId === pks.id
                return (
                  <div
                    key={pks.id}
                    className={`p-3 rounded border cursor-pointer transition-all ${isSelected ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
                    onClick={() => !pipelineId && setSelectedPksId(pks.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{pks.kode_pks_pihak_pertama || 'PKS'}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Berakhir: {pks.tanggal_berakhir ? new Date(pks.tanggal_berakhir).toLocaleDateString('id-ID') : '-'}
                        </div>
                      </div>
                      {daysLeft !== null && (
                        <Badge className={daysLeft < 14 ? 'bg-red-100 text-red-800' : daysLeft < 30 ? 'bg-orange-100 text-orange-800' : daysLeft < 90 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                          {daysLeft} hari lagi
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 1b: Catatan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">B. Catatan (opsional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            rows={2}
            placeholder="Contoh: Ada perubahan PJ atau alamat..."
            disabled={!!pipelineId}
          />
        </CardContent>
      </Card>

      {/* Step 2: Buat draft */}
      {!pipelineId && (
        <Button
          onClick={handleCreateDraft}
          disabled={loading || !selectedPksId}
          className="bg-blue-600 hover:bg-blue-700 w-full"
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat draft...</> : 'Buat Draft & Lanjut Upload File'}
        </Button>
      )}

      {/* Step 3: Upload File */}
      {pipelineId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">C. Upload File Wajib</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploader
              jenisPipeline="perpanjangan"
              pipelineId={pipelineId}
              onFilesChange={(jenisList) => {
                // Check if all wajib files uploaded
                const wajib = ['surat_permohonan_perpanjangan', 'tarif_diajukan']
                setAllFilesUploaded(wajib.every(j => jenisList.includes(j)))
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Submit */}
      {pipelineId && (
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || !allFilesUploaded}
            className="bg-green-700 hover:bg-green-800 flex-1"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</> : <><Send className="w-4 h-4 mr-2" /> Kirim ke CM</>}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>Batal</Button>
        </div>
      )}
    </div>
  )
}
