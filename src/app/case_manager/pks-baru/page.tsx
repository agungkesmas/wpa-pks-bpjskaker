'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Send, Building2, User, Wallet, FileText, Info, Plus, CheckCircle2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { FileUploader } from '@/components/wpa/FileUploader'
import { DOKUMEN_REQUIREMENTS } from '@/lib/wpa-constants'

interface UploadedFileMeta {
  jenis: string
  file_url: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
}

export default function CMPksBaruPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [allFilesUploaded, setAllFilesUploaded] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ pipeline_id: string; pic_rs_email: string; temp_password: string } | null>(null)

  // Form state
  const [faskesForm, setFaskesForm] = useState({
    nama_faskes: '', jenis_faskes: 'RS' as any, tipe_faskes: 'Umum' as any,
    alamat: '', kota: '', provinsi: '', telp: '', email_faskes: '', npwp: '',
    pj_nama: '', pj_jabatan: '', pj_phone: '',
    bank_name: '', bank_cabang: '', bank_rekening_number: '', bank_rekening_name: '',
  })

  // PIC RS account
  const [picRsForm, setPicRsForm] = useState({
    pic_rs_email: '', pic_rs_full_name: '', pic_rs_phone: '',
  })

  const [catatan, setCatatan] = useState('')

  // Since we don't have a pipeline_id yet, we'll upload files with faskes_id = 'TEMP'.
  // We'll use a temp UUID per session to group files, then move them to pipeline_id after pipeline created.
  // Simpler approach: use a session-scoped temp ID
  const [tempSessionId] = useState(() => crypto.randomUUID())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate
    if (!faskesForm.nama_faskes || !faskesForm.alamat || !faskesForm.kota || !faskesForm.provinsi ||
        !faskesForm.telp || !faskesForm.pj_nama || !faskesForm.pj_jabatan || !faskesForm.pj_phone ||
        !picRsForm.pic_rs_email || !picRsForm.pic_rs_full_name) {
      toast.error('Lengkapi semua field wajib')
      return
    }

    if (!allFilesUploaded) {
      toast.error('Semua 7 file wajib belum diupload')
      return
    }

    setLoading(true)

    try {
      // First, fetch the uploaded dokumen list using the temp session id (which we used as faskes_id placeholder)
      const listRes = await fetch(`/api/pengajuan-dokumen/list?faskes_id=${tempSessionId}`)
      const listData = await listRes.json()

      if (!listData.data || listData.data.length < 7) {
        throw new Error(`File belum lengkap.Uploaded: ${listData.data?.length || 0}, need 7.`)
      }

      // Map to dokumen_list format
      const dokumenList: UploadedFileMeta[] = listData.data.map((d: any) => ({
        jenis: d.jenis,
        file_url: d.file_url,
        file_name: d.file_name,
        file_size: d.file_size || 0,
        mime_type: d.mime_type || '',
        storage_path: d.catatan?.startsWith('storage_path:') ? d.catatan.replace('storage_path:', '') : '',
      }))

      // Submit to API
      const res = await fetch('/api/cm/pks-baru/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...faskesForm,
          ...picRsForm,
          dokumen_list: dokumenList,
          catatan,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccessInfo({
        pipeline_id: data.pipeline_id,
        pic_rs_email: data.pic_rs_email,
        temp_password: data.pic_rs_temp_password,
      })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Kembali
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-6 h-6 text-blue-600" />
          PKS Baru (CM-Driven)
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          CM terima surat fisik dari faskes → input data + upload 7 file + buat akun PIC RS.
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-700" />
        <AlertDescription className="text-blue-900">
          <strong>Alur CM:</strong> Input data faskes → Upload 7 file wajib → Buat akun PIC RS → Submit.
          Pipeline langsung masuk tahap "ditinjau" (CM review diri sendiri) → lanjut kredensialing → kajian tarif → drafting PKS → approval Kabid → review Legal RS → tanda tangan.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* A. Data Faskes */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-600" /> A. Data Faskes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Nama Faskes *</Label>
                <Input value={faskesForm.nama_faskes} onChange={e => setFaskesForm(f => ({ ...f, nama_faskes: e.target.value }))} required />
              </div>
              <div>
                <Label>Jenis Faskes *</Label>
                <Select value={faskesForm.jenis_faskes} onValueChange={v => setFaskesForm(f => ({ ...f, jenis_faskes: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RS">Rumah Sakit</SelectItem>
                    <SelectItem value="Klinik">Klinik</SelectItem>
                    <SelectItem value="Puskesmas">Puskesmas</SelectItem>
                    <SelectItem value="PraktikMandiri">Praktik Mandiri</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipe (untuk RS)</Label>
                <Select value={faskesForm.tipe_faskes} onValueChange={v => setFaskesForm(f => ({ ...f, tipe_faskes: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Umum">Umum/Bukan RS</SelectItem>
                    <SelectItem value="A">Tipe A</SelectItem>
                    <SelectItem value="B">Tipe B</SelectItem>
                    <SelectItem value="C">Tipe C</SelectItem>
                    <SelectItem value="D">Tipe D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Alamat Lengkap *</Label>
                <Textarea value={faskesForm.alamat} onChange={e => setFaskesForm(f => ({ ...f, alamat: e.target.value }))} rows={2} required />
              </div>
              <div><Label>Kota *</Label><Input value={faskesForm.kota} onChange={e => setFaskesForm(f => ({ ...f, kota: e.target.value }))} required /></div>
              <div><Label>Provinsi *</Label><Input value={faskesForm.provinsi} onChange={e => setFaskesForm(f => ({ ...f, provinsi: e.target.value }))} required /></div>
              <div><Label>Telepon *</Label><Input value={faskesForm.telp} onChange={e => setFaskesForm(f => ({ ...f, telp: e.target.value }))} required /></div>
              <div><Label>Email Faskes</Label><Input type="email" value={faskesForm.email_faskes} onChange={e => setFaskesForm(f => ({ ...f, email_faskes: e.target.value }))} /></div>
              <div><Label>NPWP</Label><Input value={faskesForm.npwp} onChange={e => setFaskesForm(f => ({ ...f, npwp: e.target.value }))} /></div>
            </div>
          </CardContent>
        </Card>

        {/* B. Penanggung Jawab */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-blue-600" /> B. Penanggung Jawab Faskes</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Nama PJ *</Label><Input value={faskesForm.pj_nama} onChange={e => setFaskesForm(f => ({ ...f, pj_nama: e.target.value }))} required /></div>
            <div><Label>Jabatan *</Label><Input value={faskesForm.pj_jabatan} onChange={e => setFaskesForm(f => ({ ...f, pj_jabatan: e.target.value }))} required /></div>
            <div><Label>HP/Telepon *</Label><Input value={faskesForm.pj_phone} onChange={e => setFaskesForm(f => ({ ...f, pj_phone: e.target.value }))} required /></div>
          </CardContent>
        </Card>

        {/* C. Bank */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-600" /> C. Data Bank</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Nama Bank</Label><Input value={faskesForm.bank_name} onChange={e => setFaskesForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
            <div><Label>Cabang</Label><Input value={faskesForm.bank_cabang} onChange={e => setFaskesForm(f => ({ ...f, bank_cabang: e.target.value }))} /></div>
            <div><Label>No. Rekening</Label><Input value={faskesForm.bank_rekening_number} onChange={e => setFaskesForm(f => ({ ...f, bank_rekening_number: e.target.value }))} /></div>
            <div><Label>Atas Nama</Label><Input value={faskesForm.bank_rekening_name} onChange={e => setFaskesForm(f => ({ ...f, bank_rekening_name: e.target.value }))} /></div>
          </CardContent>
        </Card>

        {/* D. Upload 7 file wajib */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> D. Upload 7 File Wajib
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Use tempSessionId as faskes_id placeholder — files will be linked to pipeline after creation */}
            <FileUploader
              jenisPipeline="pks_baru"
              faskesId={tempSessionId}
              onFilesChange={(jenisList) => {
                const wajib = DOKUMEN_REQUIREMENTS.pks_baru.map(r => r.jenis)
                setAllFilesUploaded(wajib.every(j => jenisList.includes(j)))
              }}
            />
          </CardContent>
        </Card>

        {/* E. Buat Akun PIC RS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> E. Buat Akun PIC RS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert className="bg-yellow-50 border-yellow-200">
              <Info className="w-4 h-4 text-yellow-700" />
              <AlertDescription className="text-yellow-900 text-xs">
                Sistem akan generate password sementara otomatis. PIC RS harus ganti password saat login pertama.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Email PIC RS *</Label>
                <Input type="email" value={picRsForm.pic_rs_email} onChange={e => setPicRsForm(f => ({ ...f, pic_rs_email: e.target.value }))} required />
              </div>
              <div>
                <Label>Nama Lengkap PIC RS *</Label>
                <Input value={picRsForm.pic_rs_full_name} onChange={e => setPicRsForm(f => ({ ...f, pic_rs_full_name: e.target.value }))} required />
              </div>
              <div className="md:col-span-2">
                <Label>No. HP PIC RS (opsional)</Label>
                <Input value={picRsForm.pic_rs_phone} onChange={e => setPicRsForm(f => ({ ...f, pic_rs_phone: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* F. Catatan */}
        <Card>
          <CardHeader><CardTitle className="text-base">F. Catatan (opsional)</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Catatan internal..." />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !allFilesUploaded} className="bg-blue-700 hover:bg-blue-800 flex-1">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat PKS Baru...</> : <><Send className="w-4 h-4 mr-2" /> Buat PKS Baru + Akun PIC RS</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
        </div>
      </form>

      {/* Success Modal */}
      <Dialog open={!!successInfo} onOpenChange={(o) => { if (!o) setSuccessInfo(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              PKS Baru Berhasil Dibuat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
              <div className="font-semibold mb-1">Akun PIC RS:</div>
              <div>Email: <strong>{successInfo?.pic_rs_email}</strong></div>
              <div>Password sementara: <code className="bg-white px-2 py-0.5 rounded">{successInfo?.temp_password}</code></div>
            </div>
            <Alert className="bg-yellow-50 border-yellow-200">
              <Info className="w-4 h-4 text-yellow-700" />
              <AlertDescription className="text-yellow-900 text-xs">
                <strong>Penting:</strong> Catat password sementara di atas dan berikan kepada PIC RS (via WhatsApp/telp).
                Password ini hanya ditampilkan sekali.
              </AlertDescription>
            </Alert>
            <p className="text-xs text-slate-500">
              Pipeline PKS Baru sudah masuk tahap "ditinjau". PIC RS akan terima notifikasi & bisa login untuk tracking.
            </p>
          </div>
          <Button onClick={() => router.push('/case_manager/tugas/detail?id=' + successInfo?.pipeline_id)}>
            Lihat Pipeline
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
