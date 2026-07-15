'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, ArrowLeft, FileEdit, Info, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { FileUploader } from '@/components/wpa/FileUploader'

type AdendumSub = 'tarif' | 'layanan_baru' | 'perubahan_data'

export default function AdendumPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sub, setSub] = useState<AdendumSub>('tarif')
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const [allFilesUploaded, setAllFilesUploaded] = useState(false)

  // Map sub → jenis pipeline
  const jenisMap: Record<AdendumSub, string> = {
    tarif: 'adendum_harga',
    layanan_baru: 'adendum_layanan_baru',
    perubahan_data: 'perubahan_data',
  }

  // Required files per sub
  const requiredFilesMap: Record<AdendumSub, string[]> = {
    tarif: ['surat_pengantar_adendum', 'lampiran_adendum', 'tarif_diajukan'],
    layanan_baru: ['surat_pengantar_adendum', 'lampiran_adendum', 'tarif_diajukan'],
    perubahan_data: ['surat_pengantar_adendum', 'lampiran_adendum'],
  }

  const subInfo: Record<AdendumSub, { label: string; desc: string; files: string }> = {
    tarif: { label: 'Adendum Tarif', desc: 'Perubahan tarif layanan yang sudah ada', files: '3 file wajib' },
    layanan_baru: { label: 'Adendum Layanan Baru', desc: 'Tambah layanan baru (otomatis include tarif baru)', files: '3 file wajib' },
    perubahan_data: { label: 'Adendum Perubahan Data', desc: 'Ubah nama, alamat, PJ, atau bank (tanpa tarif)', files: '2 file wajib' },
  }

  async function handleCreateDraft() {
    setLoading(true)
    try {
      const res = await fetch('/api/pengajuan-draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis: jenisMap[sub],
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
    if (!pipelineId) return
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
          <FileEdit className="w-6 h-6 text-purple-600" />
          Adendum
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Pilih jenis adendum → upload file wajib → kirim ke CM.
        </p>
      </div>

      {/* Step 1: Pilih Sub Jenis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A. Pilih Jenis Adendum</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['tarif', 'layanan_baru', 'perubahan_data'] as AdendumSub[]).map(s => (
              <div
                key={s}
                className={`p-3 rounded border cursor-pointer transition-all ${sub === s ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-slate-300'} ${pipelineId ? 'opacity-60 pointer-events-none' : ''}`}
                onClick={() => !pipelineId && setSub(s)}
              >
                <div className="font-semibold text-sm mb-1">{subInfo[s].label}</div>
                <div className="text-xs text-slate-500 mb-2">{subInfo[s].desc}</div>
                <Badge variant="outline" className="text-[10px]">{subInfo[s].files}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-700" />
        <AlertDescription className="text-blue-900">
          <strong>Alur:</strong> Pilih jenis → Buat draft → Upload file wajib → Submit ke CM → CM review.
        </AlertDescription>
      </Alert>

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
            placeholder="Catatan singkat untuk CM..."
            disabled={!!pipelineId}
          />
        </CardContent>
      </Card>

      {/* Step 2: Buat draft */}
      {!pipelineId && (
        <Button
          onClick={handleCreateDraft}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 w-full"
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
              jenisPipeline={jenisMap[sub]}
              pipelineId={pipelineId}
              onFilesChange={(jenisList) => {
                const wajib = requiredFilesMap[sub]
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
