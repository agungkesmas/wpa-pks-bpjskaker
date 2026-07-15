'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload, FileText, Plus, Eye, Send, CheckCircle2, XCircle, Loader2,
  Building2, AlertCircle, Info, Download
} from 'lucide-react'
import { toast } from 'sonner'

// Lazy load DocumentEditor (TipTap ~500KB) — hanya saat user edit dokumen
const DocumentEditor = dynamic(
  () => import('@/components/wpa/DocumentEditor').then(m => ({ default: m.DocumentEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Memuat editor...</span>
      </div>
    ),
  }
)

interface Template {
  id: string
  kode: string
  nama: string
  jenis: string
  versi: string
  is_national: boolean
  placeholders: string[]
  file_docx_url: string | null
  uploaded_by: string | null
  created_at: string
}

interface Dokumen {
  id: string
  jenis: string
  nomor_dokumen: string
  judul: string
  status: string
  drafted_by: string | null
  wpa_faskes: { nama: string; kota: string } | null
  drafter: { full_name: string; role: string } | null
  created_at: string
  reviewed_at: string | null
  sent_at: string | null
}

const JENIS_LABELS: Record<string, string> = {
  sp1: 'Surat Peringatan 1',
  sp2: 'Surat Peringatan 2',
  sp3: 'Surat Peringatan 3',
  ba_visitasi: 'BA Visitasi',
  surat_edaran: 'Surat Edaran',
  undangan: 'Undangan',
  surat_pemberitahuan: 'Surat Pemberitahuan',
  laporan_visitasi: 'Laporan Visitasi',
  ba_negosiasi: 'BA Negosiasi',
  lainnya: 'Lainnya',
}

const JENIS_COLORS: Record<string, string> = {
  sp1: 'bg-yellow-100 text-yellow-800',
  sp2: 'bg-orange-100 text-orange-800',
  sp3: 'bg-red-100 text-red-800',
  ba_visitasi: 'bg-blue-100 text-blue-800',
  surat_edaran: 'bg-teal-100 text-teal-800',
  undangan: 'bg-purple-100 text-purple-800',
  surat_pemberitahuan: 'bg-slate-100 text-slate-800',
  laporan_visitasi: 'bg-cyan-100 text-cyan-800',
  ba_negosiasi: 'bg-green-100 text-green-800',
  lainnya: 'bg-slate-100 text-slate-600',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  review_cm: 'Review CM',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  sent: 'Terkirim',
  archived: 'Arsip',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  review_cm: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  sent: 'bg-blue-100 text-blue-800',
  archived: 'bg-slate-100 text-slate-400',
}

interface Props {
  role: 'case_manager' | 'penata_pelayanan' | 'kepala_bidang'
}

export function DokumenOperasionalView({ role }: Props) {
  const [tab, setTab] = useState('buat')
  const [templates, setTemplates] = useState<Template[]>([])
  const [dokumens, setDokumens] = useState<Dokumen[]>([])
  const [loading, setLoading] = useState(true)
  
  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({ kode: '', nama: '', jenis: 'sp1', versi: '1.0', file: null as File | null })
  
  // Create dokumen state
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    template_operasional_id: '',
    jenis: 'sp1',
    faskes_id: '',
    pks_id: '',
    judul: '',
    narasi: '',
    deadline: '',
  })
  const [faskesList, setFaskesList] = useState<any[]>([])
  
  // Review state
  const [reviewDokumen, setReviewDokumen] = useState<Dokumen | null>(null)
  const [reviewCatatan, setReviewCatatan] = useState('')
  
  // Editor state
  const [editingDokumenId, setEditingDokumenId] = useState<string | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  
  useEffect(() => {
    fetchAll()
  }, [])
  
  async function fetchAll() {
    setLoading(true)
    try {
      const [tplRes, dokRes] = await Promise.all([
        fetch('/api/template-operasional/list'),
        fetch('/api/dokumen-operasional/list'),
      ])
      const tplData = await tplRes.json()
      const dokData = await dokRes.json()
      setTemplates(tplData.data || [])
      setDokumens(dokData.data || [])
      
      // Fetch faskes list for dropdown
      const faskesRes = await fetch('/api/faskes/multi-attach')
      const faskesData = await faskesRes.json()
      setFaskesList(faskesData.data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  
  async function handleUploadTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadForm.file || !uploadForm.kode || !uploadForm.nama) {
      toast.error('File, kode, dan nama wajib')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadForm.file)
      fd.append('kode', uploadForm.kode)
      fd.append('nama', uploadForm.nama)
      fd.append('jenis', uploadForm.jenis)
      fd.append('versi', uploadForm.versi)
      
      const res = await fetch('/api/template-operasional/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success(`Template "${uploadForm.nama}" berhasil diupload (${data.placeholder_count} placeholder)`)
      setUploadOpen(false)
      setUploadForm({ kode: '', nama: '', jenis: 'sp1', versi: '1.0', file: null })
      fetchAll()
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }
  
  async function handleCreateDokumen(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.judul) { toast.error('Judul wajib'); return }
    setCreating(true)
    try {
      const data_jsonb: any = {
        NARASI: createForm.narasi,
        DEADLINE: createForm.deadline,
      }
      
      const res = await fetch('/api/dokumen-operasional/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_operasional_id: createForm.template_operasional_id || undefined,
          jenis: createForm.jenis,
          faskes_id: createForm.faskes_id || undefined,
          pks_id: createForm.pks_id || undefined,
          judul: createForm.judul,
          data_jsonb,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success(`Dokumen "${createForm.judul}" dibuat. ${data.auto_filled} field terisi otomatis.`)
      setCreateOpen(false)
      setCreateForm({ template_operasional_id: '', jenis: 'sp1', faskes_id: '', pks_id: '', judul: '', narasi: '', deadline: '' })
      fetchAll()
      // Auto-open editor after create
      if (data.dokumen?.id) {
        setEditingDokumenId(data.dokumen.id)
      }
    } catch (e: any) { toast.error(e.message) }
    finally { setCreating(false) }
  }
  
  async function handleReview(dokumen: Dokumen, action: 'approve' | 'reject') {
    setReviewLoading(true)
    try {
      const res = await fetch('/api/dokumen-operasional/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dokumen_id: dokumen.id, action, catatan: reviewCatatan })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
      setReviewDokumen(null)
      setReviewCatatan('')
      fetchAll()
    } catch (e: any) { toast.error(e.message) }
    finally { setReviewLoading(false) }
  }
  
  async function handleSend(dokumen: Dokumen) {
    if (!confirm(`Kirim "${dokumen.judul}" ke RS?`)) return
    try {
      const res = await fetch('/api/dokumen-operasional/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dokumen_id: dokumen.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
      fetchAll()
    } catch (e: any) { toast.error(e.message) }
  }
  
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  
  const canUpload = role === 'case_manager' || role === 'penata_pelayanan' || role === 'kepala_bidang'
  const canReview = role === 'case_manager' || role === 'kepala_bidang'
  const canSend = role === 'case_manager' || role === 'kepala_bidang'
  
  // If editing, show DocumentEditor
  if (editingDokumenId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setEditingDokumenId(null); fetchAll() }}>
            ← Kembali ke Daftar
          </Button>
          <h2 className="text-lg font-semibold text-slate-900">Editor Dokumen</h2>
        </div>
        <DocumentEditor dokumenId={editingDokumenId} onClose={() => { setEditingDokumenId(null); fetchAll() }} />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dokumen Operasional</h1>
        <p className="text-sm text-slate-600">
          Buat surat teguran (SP), BA visitasi, surat edaran, dll. Data pokok auto-fill dari database.
        </p>
      </div>
      
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="buat">Buat Surat</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat ({dokumens.length})</TabsTrigger>
          {canUpload && <TabsTrigger value="template">Template ({templates.length})</TabsTrigger>}
        </TabsList>
        
        {/* TAB: Buat Surat */}
        <TabsContent value="buat" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-700 hover:bg-blue-800">
                  <Plus className="w-4 h-4 mr-2" /> Buat Dokumen Baru
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Buat Dokumen Operasional</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateDokumen} className="space-y-3">
                  <div>
                    <Label>Pilih Template (opsional)</Label>
                    <Select value={createForm.template_operasional_id} onValueChange={v => setCreateForm(f => ({ ...f, template_operasional_id: v, jenis: templates.find(t => t.id === v)?.jenis || f.jenis }))}>
                      <SelectTrigger><SelectValue placeholder="Pilih template..." /></SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nama} ({JENIS_LABELS[t.jenis] || t.jenis}) {t.is_national ? '🌐' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Jenis Dokumen *</Label>
                    <Select value={createForm.jenis} onValueChange={v => setCreateForm(f => ({ ...f, jenis: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(JENIS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Pilih Faskes (auto-fill data pokok)</Label>
                    <Select value={createForm.faskes_id} onValueChange={v => setCreateForm(f => ({ ...f, faskes_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Pilih faskes..." /></SelectTrigger>
                      <SelectContent>
                        {faskesList.map((f: any) => (
                          <SelectItem key={f.faskes_id || f.id} value={f.faskes_id || f.id}>
                            {f.wpa_faskes?.nama || f.nama || 'Faskes'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Judul *</Label>
                    <Input value={createForm.judul} onChange={e => setCreateForm(f => ({ ...f, judul: e.target.value }))} placeholder="SP1 — Tarif di luar PKS untuk RS Juanda" required />
                  </div>
                  <div>
                    <Label>Narasi / Detail</Label>
                    <Textarea value={createForm.narasi} onChange={e => setCreateForm(f => ({ ...f, narasi: e.target.value }))} rows={4} placeholder="RS Juanda menagih tarif kamar Rp 750.000 untuk kelas III, padahal di PKS Lampiran II disepakati Rp 500.000..." />
                  </div>
                  <div>
                    <Label>Deadline Perbaikan</Label>
                    <Input type="date" value={createForm.deadline} onChange={e => setCreateForm(f => ({ ...f, deadline: e.target.value }))} />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900">
                    <Info className="w-3 h-3 inline mr-1" />
                    Sistem akan auto-fill: nama faskes, alamat, NPWP, PJ, nomor PKS, nama kantor, tanggal hari ini.
                  </div>
                  <Button type="submit" disabled={creating} className="w-full">
                    {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat...</> : 'Buat Dokumen'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Review queue untuk CM */}
          {canReview && (
            <Card>
              <CardHeader><CardTitle className="text-base">Antrean Review</CardTitle></CardHeader>
              <CardContent>
                {dokumens.filter(d => d.status === 'review_cm').length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Tidak ada dokumen menunggu review</p>
                ) : (
                  <div className="space-y-2">
                    {dokumens.filter(d => d.status === 'review_cm').map(d => (
                      <div key={d.id} className="flex items-center justify-between p-2 rounded border border-yellow-200 bg-yellow-50">
                        <div>
                          <div className="text-sm font-semibold">{d.judul}</div>
                          <div className="text-xs text-slate-500">{d.nomor_dokumen} · {d.wpa_faskes?.nama || '-'} · Draft oleh: {d.drafter?.full_name}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setReviewDokumen(d); setReviewCatatan('') }}>Tinjau</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Approved — siap kirim */}
          {canSend && (
            <Card>
              <CardHeader><CardTitle className="text-base">Siap Kirim</CardTitle></CardHeader>
              <CardContent>
                {dokumens.filter(d => d.status === 'approved').length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Tidak ada dokumen siap kirim</p>
                ) : (
                  <div className="space-y-2">
                    {dokumens.filter(d => d.status === 'approved').map(d => (
                      <div key={d.id} className="flex items-center justify-between p-2 rounded border border-green-200 bg-green-50">
                        <div>
                          <div className="text-sm font-semibold">{d.judul}</div>
                          <div className="text-xs text-slate-500">{d.nomor_dokumen} · {d.wpa_faskes?.nama || '-'}</div>
                        </div>
                        <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => handleSend(d)}>
                          <Send className="w-3 h-3 mr-1" /> Kirim ke RS
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* TAB: Riwayat */}
        <TabsContent value="riwayat">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Judul</TableHead>
                    <TableHead>Faskes</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dokumens.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">Belum ada dokumen</TableCell></TableRow>
                  ) : dokumens.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.nomor_dokumen}</TableCell>
                      <TableCell className="font-medium text-sm">{d.judul}</TableCell>
                      <TableCell className="text-xs">{d.wpa_faskes?.nama || '-'}</TableCell>
                      <TableCell><Badge className={JENIS_COLORS[d.jenis]}>{JENIS_LABELS[d.jenis] || d.jenis}</Badge></TableCell>
                      <TableCell><Badge className={STATUS_COLORS[d.status]}>{STATUS_LABELS[d.status] || d.status}</Badge></TableCell>
                      <TableCell className="text-xs text-slate-500">{new Date(d.created_at).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingDokumenId(d.id)}>
                          <FileText className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB: Template */}
        {canUpload && (
          <TabsContent value="template" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Upload Template Baru</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Upload Template Operasional</DialogTitle></DialogHeader>
                  <form onSubmit={handleUploadTemplate} className="space-y-3">
                    <div><Label>Kode *</Label><Input value={uploadForm.kode} onChange={e => setUploadForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))} placeholder="SP1-TARIF-2026" required /></div>
                    <div><Label>Nama *</Label><Input value={uploadForm.nama} onChange={e => setUploadForm(f => ({ ...f, nama: e.target.value }))} placeholder="SP1 Tarif di luar PKS" required /></div>
                    <div>
                      <Label>Jenis *</Label>
                      <Select value={uploadForm.jenis} onValueChange={v => setUploadForm(f => ({ ...f, jenis: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(JENIS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>File .docx *</Label><Input type="file" accept=".docx" onChange={e => setUploadForm(f => ({ ...f, file: e.target.files?.[0] || null }))} required /></div>
                    <Button type="submit" disabled={uploading} className="w-full">
                      {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Upload...</> : 'Upload Template'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead className="text-center">Placeholder</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Belum ada template operasional</TableCell></TableRow>
                    ) : templates.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.kode}</TableCell>
                        <TableCell className="font-medium text-sm">{t.nama}</TableCell>
                        <TableCell><Badge className={JENIS_COLORS[t.jenis]}>{JENIS_LABELS[t.jenis]}</Badge></TableCell>
                        <TableCell className="text-center text-xs">{t.placeholders?.length || 0}</TableCell>
                        <TableCell>{t.is_national ? <Badge className="bg-purple-100 text-purple-800">Nasional</Badge> : <Badge variant="outline">Cabang</Badge>}</TableCell>
                        <TableCell className="text-right">
                          {t.file_docx_url && (
                            <a href={t.file_docx_url} download><Button size="icon" variant="ghost" className="h-7 w-7"><Download className="w-3 h-3" /></Button></a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      
      {/* Review modal */}
      {reviewDokumen && (
        <Dialog open={!!reviewDokumen} onOpenChange={() => { setReviewDokumen(null); setReviewCatatan('') }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Review: {reviewDokumen.judul}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded text-xs space-y-1">
                <div>Nomor: <strong>{reviewDokumen.nomor_dokumen}</strong></div>
                <div>Faskes: <strong>{reviewDokumen.wpa_faskes?.nama || '-'}</strong></div>
                <div>Dibuat oleh: <strong>{reviewDokumen.drafter?.full_name}</strong></div>
                <div>Jenis: <strong>{JENIS_LABELS[reviewDokumen.jenis]}</strong></div>
              </div>
              <div>
                <Label>Catatan Review (opsional)</Label>
                <Textarea value={reviewCatatan} onChange={e => setReviewCatatan(e.target.value)} rows={3} placeholder="Catatan untuk drafter..." />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-green-700 hover:bg-green-800" disabled={reviewLoading} onClick={() => handleReview(reviewDokumen, 'approve')}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Setujui
                </Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={reviewLoading} onClick={() => handleReview(reviewDokumen, 'reject')}>
                  <XCircle className="w-4 h-4 mr-2" /> Tolak
                </Button>
              </div>
              {reviewDokumen.jenis === 'sp3' && (
                <p className="text-xs text-orange-700 bg-orange-50 p-2 rounded">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  SP3 butuh approval Kabid setelah CM approve.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
