'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, UserPlus, ArrowLeft, Info, CheckCircle2, Copy, Printer } from 'lucide-react'
import { toast } from 'sonner'

export default function CMPksBaruPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ email: string; password: string; nama: string } | null>(null)

  const [form, setForm] = useState({
    pic_rs_email: '',
    pic_rs_full_name: '',
    pic_rs_phone: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.pic_rs_email || !form.pic_rs_full_name) {
      toast.error('Email dan nama PIC RS wajib diisi')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/cm/pks-baru/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccessInfo({
        email: data.pic_rs_email,
        password: data.pic_rs_temp_password,
        nama: form.pic_rs_full_name,
      })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Kembali
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-blue-600" />
          PKS Baru — Create User PIC RS
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          CM hanya membuat akun PIC RS + membuka menu "PKS Baru". Setelah ini, PIC RS yang upload surat + file wajib + isi data faskes saat drafting.
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-700" />
        <AlertDescription className="text-blue-900 text-sm">
          <strong>Alur PKS Baru (setelah create user):</strong><br />
          1. CM create user PIC RS (halaman ini) → PIC RS terima notifikasi + kredensial<br />
          2. PIC RS login → menu "Buat Pengajuan" → kartu "PKS Baru" AKTIF<br />
          3. PIC RS upload 7 file wajib + surat pengantar → submit ke CM<br />
          4. CM review surat + file → kredensialing → kajian tarif → drafting<br />
          5. Saat drafting, PIC RS isi data faskes + placeholder → CM review draft (3x koreksi)<br />
          6. Approval Kabid → Review Legal RS → Tanda Tangan
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buat Akun PIC RS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email PIC RS *</Label>
              <Input
                type="email"
                value={form.pic_rs_email}
                onChange={e => setForm(f => ({ ...f, pic_rs_email: e.target.value }))}
                placeholder="pic.rs@faskes.id"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Email ini akan menjadi username login PIC RS</p>
            </div>
            <div>
              <Label>Nama Lengkap PIC RS *</Label>
              <Input
                value={form.pic_rs_full_name}
                onChange={e => setForm(f => ({ ...f, pic_rs_full_name: e.target.value }))}
                placeholder="Dr. Andi Wijaya, SpOT"
                required
              />
            </div>
            <div>
              <Label>No. WA (opsional)</Label>
              <Input
                value={form.pic_rs_phone}
                onChange={e => setForm(f => ({ ...f, pic_rs_phone: e.target.value }))}
                placeholder="0812-3456-7890"
              />
              <p className="text-xs text-slate-500 mt-1">Untuk kirim kredensial via WhatsApp</p>
            </div>

            <Alert className="bg-yellow-50 border-yellow-200">
              <Info className="w-4 h-4 text-yellow-700" />
              <AlertDescription className="text-yellow-900 text-xs">
                Password akan auto-generate (12 karakter). PIC RS harus ganti password saat login pertama.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat akun...</> : <><UserPlus className="w-4 h-4 mr-2" /> Buat Akun & Buka Menu PKS Baru</>}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Success Modal */}
      <Dialog open={!!successInfo} onOpenChange={(o) => { if (!o) setSuccessInfo(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              Akun PIC RS Berhasil Dibuat
            </DialogTitle>
          </DialogHeader>
          {successInfo && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded text-sm space-y-2">
                <div><strong>Nama:</strong> {successInfo.nama}</div>
                <div><strong>Email:</strong> {successInfo.email}</div>
                <div><strong>Password sementara:</strong> <code className="bg-white px-2 py-0.5 rounded">{successInfo.password}</code></div>
              </div>

              <Alert className="bg-yellow-50 border-yellow-200">
                <Info className="w-4 h-4 text-yellow-700" />
                <AlertDescription className="text-yellow-900 text-xs">
                  <strong>Penting:</strong> Catat password sementara di atas dan berikan kepada PIC RS (via WhatsApp/telp).
                  Password ini hanya ditampilkan sekali. Menu "PKS Baru" sudah aktif untuk PIC RS ini.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${successInfo.email}\nPassword: ${successInfo.password}\nLogin: https://mitra-plkk.vercel.app`)
                    toast.success('Kredensial disalin ke clipboard')
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" /> Copy Kredensial
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    window.open(`/api/print/slip-kredensial?user_id=${successInfo.email}`, '_blank')
                  }}
                >
                  <Printer className="w-4 h-4 mr-1" /> Print Slip
                </Button>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  setSuccessInfo(null)
                  setForm({ pic_rs_email: '', pic_rs_full_name: '', pic_rs_phone: '' })
                  router.push('/case_manager')
                }}
              >
                Selesai
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
