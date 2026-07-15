'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Calendar, FileText, AlertCircle, Info } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  pksId: string
  variant?: 'default' | 'quickAction'
}

export function AjukanPerpanjanganButton({ pksId, variant = 'default' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [catatan, setCatatan] = useState('')
  
  async function handleSubmit() {
    setLoading(true)
    try {
      const res = await fetch('/api/perpanjangan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pks_id: pksId, catatan })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success(data.message)
      setOpen(false)
      setCatatan('')
      router.push('/pic_rs/pengajuan')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  
  if (variant === 'quickAction') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
            <Calendar className="w-4 h-4 mr-2" /> Ajukan Perpanjangan
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <PerpanjanganForm catatan={catatan} setCatatan={setCatatan} loading={loading} onSubmit={handleSubmit} />
        </DialogContent>
      </Dialog>
    )
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-600 hover:bg-orange-700 mt-2">
          <Calendar className="w-3 h-3 mr-1" /> Ajukan Perpanjangan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <PerpanjanganForm catatan={catatan} setCatatan={setCatatan} loading={loading} onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  )
}

function PerpanjanganForm({ catatan, setCatatan, loading, onSubmit }: {
  catatan: string
  setCatatan: (v: string) => void
  loading: boolean
  onSubmit: () => void
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-orange-600" /> Ajukan Perpanjangan PKS
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
          <Info className="w-4 h-4 inline mr-1" />
          <strong>Alur Perpanjangan:</strong><br/>
          1. Anda ajukan → 2. CM tinjau surat → 3. Kredensialing ulang (asesmen mandiri/visitasi) → 
          4. Tinjauan tarif (auto-compare) → 5. Drafting PKS (auto-clone data lama) → 
          6. Approval Kabid → 7. Review Legal RS → 8. Tanda tangan
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded p-3 text-xs text-orange-900">
          <AlertCircle className="w-4 h-4 inline mr-1" />
          <strong>Catatan:</strong> Data dari PKS lama akan otomatis di-clone saat drafting. 
          Anda tidak perlu input ulang data faskes. Cukup upload surat permohonan perpanjangan 
          dan isi catatan jika ada perubahan data.
        </div>
        <div>
          <Label>Catatan untuk CM (opsional)</Label>
          <Textarea 
            value={catatan} 
            onChange={e => setCatatan(e.target.value)} 
            rows={3} 
            placeholder="Contoh: Ada perubahan penanggung jawab, alamat, atau tarif..." 
          />
        </div>
        <Button onClick={onSubmit} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</> : 'Kirim Pengajuan Perpanjangan'}
        </Button>
      </div>
    </>
  )
}
