'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Calculator, FileSpreadsheet, Trash2, Loader2, TrendingUp, Info, Upload, Download } from 'lucide-react'
import { toast } from 'sonner'
import { BatchImportDialog } from './BatchImportDialog'

interface Acuan {
  id: string
  kategori: string
  nama_item: string
  satuan: string | null
  tarif_acuan: number
  tarif_min: number | null
  tarif_max: number | null
  tarif_median: number | null
  tarif_mean: number | null
  tarif_std_dev: number | null
  sample_count: number
  sample_data: any
  sumber: string
  catatan: string | null
  tahun: number
}

const KATEGORI_LABELS: Record<string, string> = {
  kamar: 'Kamar',
  operasi_kecil: 'Operasi Kecil',
  operasi_sedang: 'Operasi Sedang',
  operasi_besar: 'Operasi Besar',
  laboratorium: 'Laboratorium',
  radiologi: 'Radiologi',
  tindakan_medis: 'Tindakan Medis',
  rawat_inap: 'Rawat Inap',
  obat: 'Obat',
  admin: 'Administrasi',
  lainnya: 'Lainnya',
}

interface Props {
  acuanList: Acuan[]
  kantor_cabang_id: string
  tahun: number
}

export function TarifAcuanManager({ acuanList, kantor_cabang_id, tahun }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [calcLoading, setCalcLoading] = useState(false)
  const [mode, setMode] = useState<'manual' | 'calculation'>('manual')
  const [preview, setPreview] = useState<any>(null)
  const [importMode, setImportMode] = useState<'provinsi' | 'daerah'>('provinsi')
  const [importOpen, setImportOpen] = useState(false)
  
  // Manual form
  const [manualForm, setManualForm] = useState({
    kategori: 'kamar',
    nama_item: '',
    satuan: '',
    tarif_acuan: '',
    catatan: '',
  })
  
  // Calculation form
  const [calcForm, setCalcForm] = useState({
    kategori: 'kamar',
    nama_item: '',
    satuan: '',
    catatan: '',
  })
  const [samples, setSamples] = useState<{ rs_nama: string; tarif: string }[]>([
    { rs_nama: '', tarif: '' },
    { rs_nama: '', tarif: '' },
    { rs_nama: '', tarif: '' },
  ])
  
  function addSample() {
    setSamples(s => [...s, { rs_nama: '', tarif: '' }])
  }
  
  function removeSample(idx: number) {
    setSamples(s => s.filter((_, i) => i !== idx))
  }
  
  function updateSample(idx: number, field: 'rs_nama' | 'tarif', value: string) {
    setSamples(s => s.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }
  
  async function handleCalcPreview() {
    setCalcLoading(true)
    setPreview(null)
    try {
      const validSamples = samples
        .filter(s => s.rs_nama.trim() && parseFloat(s.tarif) > 0)
        .map(s => ({ rs_nama: s.rs_nama.trim(), tarif: parseFloat(s.tarif) }))
      
      if (validSamples.length < 2) {
        toast.error('Minimal 2 sample RS untuk kalkulasi rata-rata')
        return
      }
      
      const res = await fetch('/api/tarif/acuan/calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples: validSamples })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data.stats)
      toast.success(`Acuan terhitung: Rp ${data.stats.tarif_acuan.toLocaleString('id-ID')} dari ${data.stats.sample_count} sample`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCalcLoading(false)
    }
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      let body: any = {
        kantor_cabang_id,
        tahun,
        kategori: mode === 'manual' ? manualForm.kategori : calcForm.kategori,
        nama_item: mode === 'manual' ? manualForm.nama_item : calcForm.nama_item,
        satuan: mode === 'manual' ? manualForm.satuan : calcForm.satuan,
        catatan: mode === 'manual' ? manualForm.catatan : calcForm.catatan,
        sumber: mode,
      }
      
      if (mode === 'manual') {
        body.tarif_acuan = parseFloat(manualForm.tarif_acuan)
        if (!body.tarif_acuan || body.tarif_acuan <= 0) {
          toast.error('Tarif acuan harus > 0')
          setLoading(false)
          return
        }
      } else {
        const validSamples = samples
          .filter(s => s.rs_nama.trim() && parseFloat(s.tarif) > 0)
          .map(s => ({ rs_nama: s.rs_nama.trim(), tarif: parseFloat(s.tarif) }))
        if (validSamples.length < 2) {
          toast.error('Minimal 2 sample RS untuk kalkulasi')
          setLoading(false)
          return
        }
        body.sample_data = validSamples
      }
      
      const res = await fetch('/api/tarif/acuan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success(`Acuan "${body.nama_item}" berhasil disimpan`)
      setOpen(false)
      // Reset
      setManualForm({ kategori: 'kamar', nama_item: '', satuan: '', tarif_acuan: '', catatan: '' })
      setCalcForm({ kategori: 'kamar', nama_item: '', satuan: '', catatan: '' })
      setSamples([{ rs_nama: '', tarif: '' }, { rs_nama: '', tarif: '' }, { rs_nama: '', tarif: '' }])
      setPreview(null)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  
  const fmtRp = (n: number | null) => n ? `Rp ${n.toLocaleString('id-ID')}` : '-'
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Total <strong>{acuanList.length}</strong> item acuan untuk tahun {tahun}
        </div>
        <div className="flex gap-2">
          <a href="/api/tarif/template" download>
            <Button variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Download Template Excel
            </Button>
          </a>
          {/* Download template standar */}
          <a href={`/api/tarif/template-standar?mode=${importMode}`} target="_blank">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" /> Template Standar
            </Button>
          </a>
          {/* Import batch */}
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import Batch
          </Button>
          {/* Pilih mode import */}
          <select
            value={importMode}
            onChange={e => setImportMode(e.target.value as any)}
            className="border border-slate-200 rounded px-3 py-2 text-sm bg-white"
          >
            <option value="provinsi">Mode: Baku Provinsi</option>
            <option value="daerah">Mode: Rata-rata Daerah</option>
          </select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-700 hover:bg-blue-800">
                <Plus className="w-4 h-4 mr-2" /> Tambah Acuan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Tarif Acuan</DialogTitle>
              </DialogHeader>
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">
                    <FileSpreadsheet className="w-3 h-3 mr-1" /> Input Manual
                  </TabsTrigger>
                  <TabsTrigger value="calculation">
                    <Calculator className="w-3 h-3 mr-1" /> Hitung dari Sample RS
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="manual">
                  <form onSubmit={handleSubmit} className="space-y-3 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Kategori *</Label>
                        <Select value={manualForm.kategori} onValueChange={v => setManualForm(f => ({ ...f, kategori: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(KATEGORI_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Satuan</Label>
                        <Input value={manualForm.satuan} onChange={e => setManualForm(f => ({ ...f, satuan: e.target.value }))} placeholder="per hari, per tindakan" />
                      </div>
                    </div>
                    <div>
                      <Label>Nama Item *</Label>
                      <Input value={manualForm.nama_item} onChange={e => setManualForm(f => ({ ...f, nama_item: e.target.value }))} placeholder="contoh: Kamar Kelas I" required />
                    </div>
                    <div>
                      <Label>Tarif Acuan (Rp) *</Label>
                      <Input 
                        type="number" 
                        value={manualForm.tarif_acuan} 
                        onChange={e => setManualForm(f => ({ ...f, tarif_acuan: e.target.value }))} 
                        placeholder="500000" 
                        required 
                      />
                      <p className="text-xs text-slate-500 mt-1">Tarif referensi untuk item ini (akan dipakai sebagai benchmark)</p>
                    </div>
                    <div>
                      <Label>Catatan</Label>
                      <Textarea value={manualForm.catatan} onChange={e => setManualForm(f => ({ ...f, catatan: e.target.value }))} placeholder="Opsional" rows={2} />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Simpan Acuan
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="calculation">
                  <form onSubmit={handleSubmit} className="space-y-3 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Kategori *</Label>
                        <Select value={calcForm.kategori} onValueChange={v => setCalcForm(f => ({ ...f, kategori: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(KATEGORI_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Satuan</Label>
                        <Input value={calcForm.satuan} onChange={e => setCalcForm(f => ({ ...f, satuan: e.target.value }))} placeholder="per hari, per tindakan" />
                      </div>
                    </div>
                    <div>
                      <Label>Nama Item *</Label>
                      <Input value={calcForm.nama_item} onChange={e => setCalcForm(f => ({ ...f, nama_item: e.target.value }))} placeholder="contoh: Kamar Kelas I" required />
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <Label>Sample Tarif dari RS Lain *</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addSample}>
                          <Plus className="w-3 h-3 mr-1" /> Tambah RS
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">
                        Masukkan tarif dari beberapa RS sebagai sample. Sistem akan menghitung mean, median, std_dev.
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {samples.map((s, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input 
                              placeholder="Nama RS" 
                              value={s.rs_nama} 
                              onChange={e => updateSample(idx, 'rs_nama', e.target.value)}
                              className="flex-1"
                            />
                            <Input 
                              type="number" 
                              placeholder="Tarif (Rp)" 
                              value={s.tarif} 
                              onChange={e => updateSample(idx, 'tarif', e.target.value)}
                              className="w-32"
                            />
                            {samples.length > 2 && (
                              <Button type="button" size="icon" variant="ghost" onClick={() => removeSample(idx)}>
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={handleCalcPreview} disabled={calcLoading}>
                        {calcLoading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <TrendingUp className="w-3 h-3 mr-2" />}
                        Preview Kalkulasi
                      </Button>
                      
                      {preview && (
                        <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                          <div className="text-xs font-semibold text-blue-900 mb-2">Hasil Kalkulasi:</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>Sample: <strong>{preview.sample_count}</strong></div>
                            <div>Mean: <strong>{fmtRp(preview.tarif_mean)}</strong></div>
                            <div>Median: <strong>{fmtRp(preview.tarif_median)}</strong></div>
                            <div>Std Dev: <strong>{fmtRp(preview.tarif_std_dev)}</strong></div>
                            <div>Min: <strong>{fmtRp(preview.tarif_min)}</strong></div>
                            <div>Max: <strong>{fmtRp(preview.tarif_max)}</strong></div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-blue-200 text-sm">
                            Acuan (mean): <strong className="text-blue-900">{fmtRp(preview.tarif_acuan)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <Label>Catatan</Label>
                      <Textarea value={calcForm.catatan} onChange={e => setCalcForm(f => ({ ...f, catatan: e.target.value }))} placeholder="Opsional" rows={2} />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Simpan Acuan (dari kalkulasi)
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {acuanList.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Belum ada tarif acuan. Klik "Tambah Acuan" untuk mulai input tarif referensi.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Tarif acuan akan dipakai sebagai benchmark saat faskes upload tarif mereka.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Nama Item</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead className="text-right">Tarif Acuan</TableHead>
                  <TableHead className="text-right">Min / Max</TableHead>
                  <TableHead className="text-center">Sample</TableHead>
                  <TableHead>Sumber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acuanList.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge variant="outline">{KATEGORI_LABELS[a.kategori] || a.kategori}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{a.nama_item}</TableCell>
                    <TableCell className="text-xs text-slate-500">{a.satuan || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtRp(a.tarif_acuan)}</TableCell>
                    <TableCell className="text-right text-xs text-slate-500">
                      {a.tarif_min ? fmtRp(a.tarif_min) : '-'} / {a.tarif_max ? fmtRp(a.tarif_max) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.sample_count > 0 ? (
                        <Badge className="bg-blue-100 text-blue-800">{a.sample_count} RS</Badge>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.sumber === 'calculation' ? (
                        <Badge className="bg-teal-100 text-teal-800">Kalkulasi</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700">Manual</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Import Batch Dialog */}
      <BatchImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title={`Import Tarif Acuan — ${importMode === 'daerah' ? 'Rata-rata Daerah' : 'Baku Provinsi'}`}
        templateUrl={`/api/tarif/template-standar?mode=${importMode}`}
        importUrl={`/api/tarif/batch-import?mode=${importMode}&tahun=${tahun}`}
        entityName="tarif"
        columns={[
          { key: 'kategori', label: 'Kategori' },
          { key: 'kode_item', label: 'Kode Item' },
          { key: 'nama_item_standar', label: 'Nama Item Standar', required: true },
          { key: 'nama_item_alias', label: 'Alias' },
          { key: 'satuan', label: 'Satuan' },
          ...(importMode === 'daerah'
            ? [{ key: 'RS_1_nama', label: 'RS 1 Nama' }, { key: 'RS_1_tarif', label: 'RS 1 Tarif' }, { key: 'RS_2_nama', label: 'RS 2 Nama' }, { key: 'RS_2_tarif', label: 'RS 2 Tarif' }, { key: 'RS_3_nama', label: 'RS 3 Nama' }, { key: 'RS_3_tarif', label: 'RS 3 Tarif' }]
            : [{ key: 'tarif_acuan_provinsi', label: 'Tarif Acuan Provinsi', required: true }]
          ),
          { key: 'catatan', label: 'Catatan' },
        ]}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
