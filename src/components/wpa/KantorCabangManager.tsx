'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Building2, Users, ShieldCheck, Plus, MapPin, Phone, ChevronRight, Upload, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { BatchImportDialog } from './BatchImportDialog'

interface Kantor {
  id: string
  kode: string
  nama: string
  alamat: string | null
  kota: string | null
  provinsi: string | null
  telp: string | null
  email: string | null
  is_active: boolean
  stats: { users: number; faskes: number; pks_aktif: number }
}

export function KantorCabangManager({ kantorList, canCreate }: { kantorList: Kantor[]; canCreate: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({
    kode: '', nama: '', alamat: '', kota: '', provinsi: '', telp: '', email: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/kantor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Kantor cabang "${form.nama}" berhasil dibuat`)
      setOpen(false)
      setForm({ kode: '', nama: '', alamat: '', kota: '', provinsi: '', telp: '', email: '' })
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(kantorList.map(k => k.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function handlePrintSelected() {
    if (selectedIds.size === 0) {
      toast.error('Pilih kantor dulu')
      return
    }
    // Print semua kredensial user dari kantor terpilih (buka per kantor)
    const ids = Array.from(selectedIds)
    ids.forEach(kantorId => {
      window.open(`/api/print/slip-kredensial?kantor_cabang_id=${kantorId}`, '_blank')
    })
  }

  const kantorColumns = [
    { key: 'kode', label: 'Kode', required: true },
    { key: 'nama', label: 'Nama', required: true },
    { key: 'alamat', label: 'Alamat' },
    { key: 'kota', label: 'Kota' },
    { key: 'provinsi', label: 'Provinsi' },
    { key: 'telp', label: 'Telp' },
    { key: 'email', label: 'Email' },
  ]

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import Excel
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-rose-700 hover:bg-rose-800">
                <Plus className="w-4 h-4 mr-2" /> Tambah Kantor Cabang
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Kantor Cabang</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kode *</Label>
                    <Input value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))} placeholder="KC-CIREBON" required />
                  </div>
                  <div>
                    <Label>Nama *</Label>
                    <Input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="BPJS Cabang Cirebon" required />
                  </div>
                </div>
                <div>
                  <Label>Alamat</Label>
                  <Input value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))} placeholder="Jl. ..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Kota</Label><Input value={form.kota} onChange={e => setForm(f => ({ ...f, kota: e.target.value }))} /></div>
                  <div><Label>Provinsi</Label><Input value={form.provinsi} onChange={e => setForm(f => ({ ...f, provinsi: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telepon</Label><Input value={form.telp} onChange={e => setForm(f => ({ ...f, telp: e.target.value }))} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Menyimpan...' : 'Buat Kantor Cabang'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="text-sm">
            <strong>{selectedIds.size}</strong> kantor dipilih
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrintSelected}>
              <Printer className="w-3 h-3 mr-1" /> Print Semua Kredensial
            </Button>
            <Button size="sm" variant="outline" onClick={clearSelection}>Batal Pilih</Button>
          </div>
        </div>
      )}

      {kantorList.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Belum ada kantor cabang terdaftar</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Select all checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === kantorList.length && kantorList.length > 0}
              onCheckedChange={(v) => v ? selectAll() : clearSelection()}
            />
            <span className="text-sm text-slate-600">Pilih Semua ({kantorList.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kantorList.map(k => (
              <div key={k.id} className="relative">
                <div className="absolute top-3 left-3 z-10">
                  <Checkbox
                    checked={selectedIds.has(k.id)}
                    onCheckedChange={() => toggleSelect(k.id)}
                  />
                </div>
                <Link href={`/super_admin/kantor/${k.id}`}>
                  <Card className="hover:shadow-lg hover:border-rose-300 transition-all cursor-pointer h-full">
                    <CardContent className="p-5 pl-12">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-700 to-rose-900 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <Badge variant={k.is_active ? 'default' : 'destructive'} className={k.is_active ? 'bg-green-100 text-green-800' : ''}>
                          {k.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-slate-900 text-base mb-1 line-clamp-2">{k.nama}</h3>
                      <p className="text-xs text-slate-500 mb-3 font-mono">{k.kode}</p>

                      {k.alamat && (
                        <div className="text-xs text-slate-600 mb-2 flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
                          <span className="line-clamp-2">{k.alamat}{k.kota ? `, ${k.kota}` : ''}</span>
                        </div>
                      )}
                      {k.telp && (
                        <div className="text-xs text-slate-600 mb-2 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {k.telp}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
                        <div className="text-center">
                          <div className="text-lg font-bold text-slate-900">{k.stats.users}</div>
                          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                            <Users className="w-2.5 h-2.5" /> User
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-slate-900">{k.stats.faskes}</div>
                          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                            <Building2 className="w-2.5 h-2.5" /> Faskes
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-700">{k.stats.pks_aktif}</div>
                          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" /> PKS
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end text-rose-700 text-xs font-semibold">
                        Kelola <ChevronRight className="w-3 h-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Import Dialog */}
      <BatchImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Kantor Cabang via Excel"
        templateUrl="/api/kantor/template"
        importUrl="/api/kantor/batch-import"
        entityName="kantor"
        columns={kantorColumns}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
