'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, Building2, User, Wallet, FileText, Info } from 'lucide-react'
import { toast } from 'sonner'

export default function AjukanPKSBaruPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nama_faskes: '',
    jenis_faskes: 'RS' as 'RS' | 'Klinik' | 'Puskesmas' | 'PraktikMandiri' | 'Lainnya',
    tipe_faskes: 'Umum' as 'A' | 'B' | 'C' | 'D' | 'Umum',
    alamat: '',
    kota: '',
    provinsi: '',
    telp: '',
    email_faskes: '',
    npwp: '',
    pj_nama: '',
    pj_jabatan: '',
    pj_phone: '',
    bank_name: '',
    bank_cabang: '',
    bank_rekening_number: '',
    bank_rekening_name: '',
    catatan: '',
  })
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/pengajuan-baru/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Pengajuan berhasil dikirim ke BPJS Ketenagakerjaan')
      router.push(`/pic_rs/pengajuan?p=${data.pipeline_id}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ajukan PKS Baru</h1>
        <p className="text-sm text-slate-600">
          Isi data faskes Anda untuk mengajukan PKS kerjasama dengan BPJS Ketenagakerjaan. 
          Setelah dikirim, akan masuk ke Case Manager BPJS untuk ditinjau.
        </p>
      </div>
      
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-700" />
        <AlertDescription className="text-blue-900">
          <strong>Alur Pengajuan:</strong> Submit form → CM BPJS review (Tahap Ditinjau) → Kredensialing → 
          Negosiasi Tarif (Anda upload tarif, sistem auto-compare dengan Bank Tarif acuan) → Drafting PKS → 
          Approval Kabid → Review Legal RS (Anda) → Tanda Tangan.
        </AlertDescription>
      </Alert>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* A. Data Faskes */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-orange-600" /> A. Data Faskes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Nama Faskes *</Label>
                <Input value={form.nama_faskes} onChange={e => setForm(f => ({ ...f, nama_faskes: e.target.value }))} placeholder="RS Contoh, Klinik Sehat, dll" required />
              </div>
              <div>
                <Label>Jenis Faskes *</Label>
                <Select value={form.jenis_faskes} onValueChange={v => setForm(f => ({ ...f, jenis_faskes: v as any }))}>
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
                <Select value={form.tipe_faskes} onValueChange={v => setForm(f => ({ ...f, tipe_faskes: v as any }))}>
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
                <Textarea value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))} rows={2} placeholder="Jl. ..." required />
              </div>
              <div>
                <Label>Kota *</Label>
                <Input value={form.kota} onChange={e => setForm(f => ({ ...f, kota: e.target.value }))} required />
              </div>
              <div>
                <Label>Provinsi *</Label>
                <Input value={form.provinsi} onChange={e => setForm(f => ({ ...f, provinsi: e.target.value }))} required />
              </div>
              <div>
                <Label>Telepon *</Label>
                <Input value={form.telp} onChange={e => setForm(f => ({ ...f, telp: e.target.value }))} placeholder="021-1234567" required />
              </div>
              <div>
                <Label>Email Faskes</Label>
                <Input type="email" value={form.email_faskes} onChange={e => setForm(f => ({ ...f, email_faskes: e.target.value }))} />
              </div>
              <div>
                <Label>NPWP</Label>
                <Input value={form.npwp} onChange={e => setForm(f => ({ ...f, npwp: e.target.value }))} placeholder="01.234.567.8-901.000" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* B. Penanggung Jawab */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-orange-600" /> B. Penanggung Jawab Faskes</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Nama PJ *</Label>
              <Input value={form.pj_nama} onChange={e => setForm(f => ({ ...f, pj_nama: e.target.value }))} required />
            </div>
            <div>
              <Label>Jabatan *</Label>
              <Input value={form.pj_jabatan} onChange={e => setForm(f => ({ ...f, pj_jabatan: e.target.value }))} placeholder="Direktur, Kepala Klinik" required />
            </div>
            <div>
              <Label>HP/Telepon PJ *</Label>
              <Input value={form.pj_phone} onChange={e => setForm(f => ({ ...f, pj_phone: e.target.value }))} placeholder="0812..." required />
            </div>
          </CardContent>
        </Card>
        
        {/* C. Bank */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4 text-orange-600" /> C. Data Bank (untuk Tagihan)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nama Bank</Label>
              <Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="BRI, BNI, Mandiri" />
            </div>
            <div>
              <Label>Cabang</Label>
              <Input value={form.bank_cabang} onChange={e => setForm(f => ({ ...f, bank_cabang: e.target.value }))} />
            </div>
            <div>
              <Label>No. Rekening</Label>
              <Input value={form.bank_rekening_number} onChange={e => setForm(f => ({ ...f, bank_rekening_number: e.target.value }))} />
            </div>
            <div>
              <Label>Atas Nama</Label>
              <Input value={form.bank_rekening_name} onChange={e => setForm(f => ({ ...f, bank_rekening_name: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
        
        {/* D. Catatan */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-orange-600" /> D. Catatan Tambahan</CardTitle></CardHeader>
          <CardContent>
            <Textarea 
              value={form.catatan} 
              onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} 
              rows={3} 
              placeholder="Catatan untuk CM BPJS (opsional)..." 
            />
          </CardContent>
        </Card>
        
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700 flex-1">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</> : <><Send className="w-4 h-4 mr-2" /> Kirim Pengajuan</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
        </div>
      </form>
    </div>
  )
}
