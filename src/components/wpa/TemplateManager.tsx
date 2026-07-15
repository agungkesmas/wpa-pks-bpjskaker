'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, FileText, ShieldCheck, Lock, Loader2, Plus, Eye, 
  Power, Hash, Layers, AlertCircle, CheckCircle2, Info
} from 'lucide-react'
import { toast } from 'sonner'

interface Template {
  id: string
  kode: string
  nama: string
  version: string
  jenis_dokumen: string
  template_hash: string | null
  bab_hashes: any
  pasal_count: number
  lampiran_count: number
  placeholders: any
  is_active: boolean
  is_locked: boolean
  is_masal: boolean
  judul_kartu: string | null
  file_docx_url: string | null
  uploaded_by: string | null
  uploaded_at: string
}

const JENIS_LABELS: Record<string, string> = {
  pks: 'PKS',
  adendum_ayat: 'Adendum Ayat',
  adendum_harga: 'Adendum Harga',
  sk_mutasi: 'SK Mutasi',
  ba_negosiasi: 'BA Negosiasi',
  surat_edaran: 'Surat Edaran',
  sp_pembinaan: 'SP Pembinaan',
  other: 'Lainnya',
}

const JENIS_COLORS: Record<string, string> = {
  pks: 'bg-blue-100 text-blue-800',
  adendum_ayat: 'bg-purple-100 text-purple-800',
  adendum_harga: 'bg-orange-100 text-orange-800',
  sk_mutasi: 'bg-slate-100 text-slate-800',
  ba_negosiasi: 'bg-teal-100 text-teal-800',
  surat_edaran: 'bg-yellow-100 text-yellow-800',
  sp_pembinaan: 'bg-red-100 text-red-800',
  other: 'bg-slate-100 text-slate-600',
}

export function TemplateManager({ templates: initialTemplates }: { templates: Template[] }) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState<Template | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [form, setForm] = useState({
    kode: '',
    nama: '',
    jenis_dokumen: 'pks',
    versi: '1.0',
    is_masal: false,
    judul_kartu: '',
    file: null as File | null,
  })
  
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!form.file || !form.kode || !form.nama) {
      toast.error('File, kode, dan nama wajib')
      return
    }
    setUploading(true)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', form.file)
      fd.append('kode', form.kode)
      fd.append('nama', form.nama)
      fd.append('jenis_dokumen', form.jenis_dokumen)
      fd.append('versi', form.versi)
      fd.append('is_masal', form.is_masal ? 'true' : 'false')
      fd.append('judul_kartu', form.judul_kartu)
      
      const res = await fetch('/api/template/upload', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setUploadResult(data.summary)
      toast.success(`Template "${form.nama}" berhasil diupload & diaktifkan`)
      setUploadOpen(false)
      setForm({ kode: '', nama: '', jenis_dokumen: 'pks', versi: '1.0', is_masal: false, judul_kartu: '', file: null })
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }
  
  async function toggleActive(t: Template) {
    try {
      const res = await fetch('/api/template/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: t.id, is_active: !t.is_active })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  
  async function viewDetail(t: Template) {
    try {
      const res = await fetch(`/api/template/detail/${t.id}`)
      const data = await res.json()
      if (res.ok) {
        setDetailOpen(data.data)
      }
    } catch (e) {
      console.error(e)
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rose-700 hover:bg-rose-800">
              <Plus className="w-4 h-4 mr-2" /> Upload Template Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Template Mandatori</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-3">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-700" />
                <AlertDescription className="text-blue-900 text-xs">
                  Sistem akan otomatis: parse placeholder, hitung hash per bab, klasifikasi placeholder (auto/manual), 
                  dan aktifkan template ini. Template lama dengan jenis sama akan dinonaktifkan.
                </AlertDescription>
              </Alert>
              <div>
                <Label>Kode Template *</Label>
                <Input value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))} placeholder="PKS-PLKK-2026" required />
              </div>
              <div>
                <Label>Nama Template *</Label>
                <Input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="PKS PLKK 2026" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Jenis Dokumen</Label>
                  <Select value={form.jenis_dokumen} onValueChange={v => setForm(f => ({ ...f, jenis_dokumen: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(JENIS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Versi</Label>
                  <Input value={form.versi} onChange={e => setForm(f => ({ ...f, versi: e.target.value }))} placeholder="1.0" />
                </div>
              </div>
              <div>
                <Label>File .docx *</Label>
                <Input 
                  type="file" 
                  accept=".docx" 
                  onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
                  required
                />
                {form.file && <p className="text-xs text-slate-500 mt-1">{form.file.name} ({(form.file.size / 1024).toFixed(1)} KB)</p>}
              </div>
              
              {/* Template Masal toggle */}
              <div className="p-3 rounded border border-amber-200 bg-amber-50/50">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_masal}
                    onChange={e => setForm(f => ({ ...f, is_masal: e.target.checked }))}
                    className="mt-1 w-4 h-4 accent-amber-600"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                      🟤 Template Masal (Adendum Dropping Pusat)
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Centang jika template ini adalah adendum masal dari kantor pusat.
                      Akan muncul sebagai kartu coklat di menu "Buat Pengajuan" PIC RS.
                    </p>
                  </div>
                </label>
                {form.is_masal && (
                  <div className="mt-3">
                    <Label>Judul Kartu (yang dilihat PIC RS) *</Label>
                    <Input
                      value={form.judul_kartu}
                      onChange={e => setForm(f => ({ ...f, judul_kartu: e.target.value }))}
                      placeholder="Contoh: Perubahan Pasal 4.c Rawat Inap"
                      required={form.is_masal}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Judul singkat yang akan ditampilkan di kartu coklat PIC RS.
                    </p>
                  </div>
                )}
              </div>
              
              <Button type="submit" disabled={uploading} className="w-full">
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Upload & Parse...</> : <><Upload className="w-4 h-4 mr-2" /> Upload Template</>}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-1">Belum ada template terdaftar</p>
            <p className="text-xs text-slate-400">Upload template PKS/Adendum/SK dari kantor pusat untuk mulai</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Versi</TableHead>
                  <TableHead className="text-center">Bab</TableHead>
                  <TableHead className="text-center">Placeholder</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Masal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.kode}</TableCell>
                    <TableCell className="font-medium">{t.nama}</TableCell>
                    <TableCell><Badge className={JENIS_COLORS[t.jenis_dokumen] || JENIS_COLORS.other}>{JENIS_LABELS[t.jenis_dokumen] || t.jenis_dokumen}</Badge></TableCell>
                    <TableCell className="text-xs">v{t.version}</TableCell>
                    <TableCell className="text-center text-xs">{t.pasal_count + t.lampiran_count}</TableCell>
                    <TableCell className="text-center text-xs">{Array.isArray(t.placeholders) ? t.placeholders.length : 0}</TableCell>
                    <TableCell className="text-center">
                      {t.is_active ? <Badge className="bg-green-100 text-green-800">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                      {t.is_locked && <Lock className="w-3 h-3 inline ml-1 text-slate-400" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {t.is_masal ? (
                        <Badge className="bg-amber-100 text-amber-800" title={t.judul_kartu || ''}>
                          🟤 {t.judul_kartu ? (t.judul_kartu.length > 20 ? t.judul_kartu.slice(0, 20) + '...' : t.judul_kartu) : 'Masal'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => viewDetail(t)} title="Lihat Detail">
                          <Eye className="w-3 h-3 text-blue-700" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(t)} title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                          <Power className={`w-3 h-3 ${t.is_active ? 'text-red-600' : 'text-green-600'}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Upload result modal */}
      {uploadResult && (
        <Dialog open={!!uploadResult} onOpenChange={() => setUploadResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Template Berhasil Diupload
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded border border-slate-200">
                  <div className="text-xs text-slate-500">Total Bab</div>
                  <div className="font-bold text-lg">{uploadResult.total_bab}</div>
                </div>
                <div className="p-2 rounded border border-slate-200">
                  <div className="text-xs text-slate-500">Total Placeholder</div>
                  <div className="font-bold text-lg">{uploadResult.total_placeholder}</div>
                </div>
                <div className="p-2 rounded border border-green-200 bg-green-50">
                  <div className="text-xs text-green-700">Auto-Fill</div>
                  <div className="font-bold text-lg text-green-800">{uploadResult.auto_fill}</div>
                </div>
                <div className="p-2 rounded border border-yellow-200 bg-yellow-50">
                  <div className="text-xs text-yellow-700">Manual Required</div>
                  <div className="font-bold text-lg text-yellow-800">{uploadResult.manual_required}</div>
                </div>
                <div className="p-2 rounded border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-600">Manual Optional</div>
                  <div className="font-bold text-lg text-slate-700">{uploadResult.manual_optional}</div>
                </div>
                <div className="p-2 rounded border border-slate-200">
                  <div className="text-xs text-slate-500">Hash</div>
                  <div className="font-mono text-xs text-slate-700">{uploadResult.template_hash}</div>
                </div>
              </div>
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-700" />
                <AlertDescription className="text-blue-900 text-xs">
                  Template telah diaktifkan. Saat drafting PKS, sistem akan auto-fill placeholder auto_*, 
                  dan CM tinggal input placeholder manual_required.
                </AlertDescription>
              </Alert>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Detail modal */}
      {detailOpen && (
        <Dialog open={!!detailOpen} onOpenChange={() => setDetailOpen(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-700" />
                {detailOpen.nama} (v{detailOpen.version})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded border border-slate-200">
                  <div className="text-slate-500">Kode</div>
                  <div className="font-mono font-semibold">{detailOpen.kode}</div>
                </div>
                <div className="p-2 rounded border border-slate-200">
                  <div className="text-slate-500">Pasal / Lampiran</div>
                  <div className="font-semibold">{detailOpen.pasal_count} / {detailOpen.lampiran_count}</div>
                </div>
                <div className="p-2 rounded border border-slate-200">
                  <div className="text-slate-500">Hash (16 char)</div>
                  <div className="font-mono">{detailOpen.template_hash?.substring(0, 16) || '-'}...</div>
                </div>
              </div>
              
              {/* Babs */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-600" /> Struktur Bab ({(detailOpen as any)?.babs?.length || 0})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {((detailOpen as any)?.babs || []).map((bab: any) => (
                    <div key={bab.id} className="flex items-center justify-between p-2 rounded border border-slate-200 text-xs">
                      <div>
                        <span className="font-mono text-slate-500 mr-2">#{bab.urutan}</span>
                        <span className="font-semibold">{bab.bab_label}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">{bab.bab_type}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {bab.placeholder_keys?.length > 0 && (
                          <Badge className="bg-blue-100 text-blue-800 text-[10px]">{bab.placeholder_keys.length} placeholder</Badge>
                        )}
                        <Hash className="w-3 h-3 text-slate-400" />
                        <span className="font-mono text-[10px] text-slate-500">{bab.content_hash?.substring(0, 8)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Placeholders */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600" /> Placeholder ({detailOpen.placeholders?.length || 0})
                </h4>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(detailOpen.placeholders || []).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-700">{`{{${p.key}}}`}</span>
                        <span className="text-slate-400 text-[10px]">{p.bab_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.tipe === 'auto_faskes' && <Badge className="bg-green-100 text-green-800 text-[10px]">Auto Faskes</Badge>}
                        {p.tipe === 'auto_kantor' && <Badge className="bg-teal-100 text-teal-800 text-[10px]">Auto Kantor</Badge>}
                        {p.tipe === 'auto_user' && <Badge className="bg-cyan-100 text-cyan-800 text-[10px]">Auto User</Badge>}
                        {p.tipe === 'auto_tarif' && <Badge className="bg-orange-100 text-orange-800 text-[10px]">Auto Tarif</Badge>}
                        {p.tipe === 'manual_required' && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Manual Wajib</Badge>}
                        {p.tipe === 'manual_optional' && <Badge className="bg-slate-100 text-slate-600 text-[10px]">Manual Opsional</Badge>}
                        {p.tipe === 'calculated' && <Badge className="bg-purple-100 text-purple-800 text-[10px]">Calculated</Badge>}
                        {p.source_table && <span className="text-[10px] text-slate-400">{p.source_table}.{p.source_column}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {detailOpen.file_docx_url && (
                <a href={detailOpen.file_docx_url} download className="block">
                  <Button variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" /> Download .docx Asli
                  </Button>
                </a>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
