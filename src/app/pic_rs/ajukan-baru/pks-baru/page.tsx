'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, ArrowLeft, Plus, Info } from 'lucide-react'
import { toast } from 'sonner'
import { FileUploader } from '@/components/wpa/FileUploader'
import { DOKUMEN_REQUIREMENTS } from '@/lib/wpa-constants'

function PksBaruPageInner() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const [allFilesUploaded, setAllFilesUploaded] = useState(false)
  const [canSubmit, setCanSubmit] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    try {
      // Cek apakah PIC RS boleh submit PKS Baru
      // dan apakah sudah ada PKS Baru in-progress
      const res = await fetch('/api/pipeline/list?initiated_by_me=true&include_all_status=true')
      const data = await res.json()
      const pipelines = data.data || []
      const hasPksBaru = pipelines.some((p: any) => p.jenis === 'pks_baru' && p.status === 'in_progress')
      if (hasPksBaru) {
        toast.error('Anda sudah punya PKS Baru yang sedang diproses')
        router.push('/pic_rs/ajukan-baru')
        return
      }
      setCanSubmit(true)
    } catch (e: any) {
      toast.error(e.message)
      router.push('/pic_rs/ajukan-baru')
    } finally {
      setCheckingStatus(false)
    }
  }

  async function handleCreateDraft() {
    setLoading(true)
    try {
      const res = await fetch('/api/pengajuan-draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis: 'pks_baru',
          catatan,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPipelineId(data.pipeline_id)
      toast.success('Draft pipeline dibuat. Silakan upload 7 file wajib.')
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
      toast.error('Semua 7 file wajib belum diupload')
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

  if (checkingStatus) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }

  if (!canSubmit) {
    return (
      <div className="text-center py-12">
        <Alert className="bg-yellow-50 border-yellow-200 max-w-md mx-auto">
          <Info className="w-4 h-4 text-yellow-700" />
          <AlertDescription className="text-yellow-900">
            Anda belum bisa mengajukan PKS Baru. Hubungi Case Manager BPJS untuk membuatkan akun.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 7 file wajib untuk PKS Baru
  const wajibFiles = DOKUMEN_REQUIREMENTS.pks_baru.map(r => r.jenis)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Kembali
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-6 h-6 text-orange-600" />
          PKS Baru — Upload File Wajib
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Upload 7 file wajib + surat pengantar. Setelah kirim, CM akan review. Saat drafting, Anda isi data faskes.
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-700" />
        <AlertDescription className="text-blue-900">
          <strong>Alur PKS Baru:</strong> Upload 7 file → CM review → kredensialing → kajian tarif → drafting (Anda isi data faskes + placeholder) → CM review draft (3x koreksi) → approval Kabid → review Legal RS → tanda tangan.
        </AlertDescription>
      </Alert>

      {/* Step 1: Catatan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A. Catatan (opsional)</CardTitle>
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
          className="bg-orange-600 hover:bg-orange-700 w-full"
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat draft...</> : 'Buat Draft & Lanjut Upload File'}
        </Button>
      )}

      {/* Step 3: Upload File */}
      {pipelineId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">B. Upload 7 File Wajib</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploader
              jenisPipeline="pks_baru"
              pipelineId={pipelineId}
              onFilesChange={(jenisList) => {
                setAllFilesUploaded(wajibFiles.every(j => jenisList.includes(j)))
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

// Wrap with Suspense for useSearchParams (Next.js 16 requirement)
export default function PksBaruPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
      <PksBaruPageInner />
    </Suspense>
  )
}
