'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, Building2, User, Wallet, FileText, Info, Calendar, Plus, RefreshCw, FileEdit, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

type JenisPengajuan =
  | 'pks_baru'
  | 'perpanjangan'
  | 'adendum_harga'
  | 'adendum_layanan_baru'
  | 'perubahan_data'

type AdendumSub = 'tarif' | 'layanan_baru' | 'perubahan_data'

export default function AjukanPage() {
  const router = useRouter()
  const params = useSearchParams()
  const initialJenis = params.get('jenis') as JenisPengajuan | null

  const [jenis, setJenis] = useState<'pks_baru' | 'perpanjangan' | 'adendum'>(initialJenis === 'perpanjangan' ? 'perpanjangan' : initialJenis === 'pks_baru' ? 'pks_baru' : initialJenis ? 'adendum' : 'pks_baru')
  const [adendumSub, setAdendumSub] = useState<AdendumSub>(
    initialJenis === 'adendum_harga' ? 'tarif' :
    initialJenis === 'adendum_layanan_baru' ? 'layanan_baru' :
    initialJenis === 'perubahan_data' ? 'perubahan_data' : 'tarif'
  )
  const [loading, setLoading] = useState(false)
  const [pksList, setPksList] = useState<any[]>([])
  const [selectedPksId, setSelectedPksId] = useState('')

  // Final jenis (computed)
  const finalJenis: JenisPengajuan =
    jenis === 'pks_baru' ? 'pks_baru' :
    jenis === 'perpanjangan' ? 'perpanjangan' :
    adendumSub === 'tarif' ? 'adendum_harga' :
    adendumSub === 'layanan_baru' ? 'adendum_layanan_baru' :
    'perubahan_data'

  // Form PKS Baru
  const [pksBaruForm, setPksBaruForm] = useState({
    nama_faskes: '', jenis_faskes: 'RS' as any, tipe_faskes: 'Umum' as any,
    alamat: '', kota: '', provinsi: '', telp: '', email_faskes: '', npwp: '',
    pj_nama: '', pj_jabatan: '', pj_phone: '',
    bank_name: '', bank_cabang: '', bank_rekening_number: '', bank_rekening_name: '',
    catatan: '',
  })

  // Form Adendum
  const [adendumForm, setAdendumForm] = useState({
    judul: '',
    deskripsi_perubahan: '',
    dokumen_pendukung_url: '',
    catatan: '',
  })

  // Form Perpanjangan
  const [perpanjanganForm, setPerpanjanganForm] = useState({ catatan: '' })

  useEffect(() => {
    async function fetchPks() {
      try {
        const pksRes = await fetch('/api/pks/aktif')
        if (pksRes.ok) {
          const pksData = await pksRes.json()
          setPksList(pksData.data || [])
        }
      } catch (e) { console.error(e) }
    }
    fetchPks()
  }, [])

  async function handleSubmitPksBaru(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/pengajuan-baru/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pksBaruForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Pengajuan PKS Baru berhasil dikirim ke BPJS Ketenagakerjaan')
      router.push(`/pic_rs/pengajuan?p=${data.pipeline_id}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitPerpanjangan(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPksId) { toast.error('Pilih PKS yang akan diperpanjang'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/perpanjangan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pks_id: selectedPksId, catatan: perpanjanganForm.catatan })
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

  async function handleSubmitAdendum(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/adendum/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jenis: finalJenis, ...adendumForm })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Pengajuan adendum berhasil dikirim')
      router.push('/pic_rs/pengajuan')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Flow descriptions (with renamed "Kajian Tarif" + "Kredensialing Ulang")
  const flowDescriptions: Record<JenisPengajuan, string> = {
    pks_baru: 'Submit form → CM Tinjau → Kredensialing → Kajian Tarif → Drafting PKS → Approval Kabid → Review Legal RS → Tanda Tangan',
    perpanjangan: 'Ajukan → CM Tinjau → Kredensialing Ulang → Kajian Tarif (conditional) → Drafting PKS (auto-clone) → Approval Kabid → Review Legal RS → Tanda Tangan',
    adendum_harga: 'Ajukan → CM Tinjau → Kredensialing Ulang → Kajian Tarif → Drafting Adendum → Approval Kabid → Review Legal RS → Tanda Tangan',
    adendum_layanan_baru: 'Ajukan → CM Tinjau → Kredensialing Ulang → Kajian Tarif → Drafting Adendum → Approval Kabid → Review Legal RS → Tanda Tangan',
    perubahan_data: 'Ajukan → CM Tinjau → Drafting Adendum (skip Kredensialing Ulang & Kajian Tarif) → Approval Kabid → Review Legal RS → Tanda Tangan',
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Buat Pengajuan</h1>
        <p className="text-sm text-slate-600">
          Pilih jenis pengajuan sesuai kebutuhan Anda. Untuk Adendum Dropping Pusat, mohon tunggu CM/Kabid yang akan broadcast ke faskes Anda.
        </p>
      </div>

      {/* Pilihan Jenis Utama (3 pilihan) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card
          className={`cursor-pointer transition-all ${jenis === 'pks_baru' ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200' : 'border-slate-200 hover:border-slate-300'}`}
          onClick={() => setJenis('pks_baru')}
        >
          <CardContent className="p-4 text-center">
            <Plus className={`w-8 h-8 mx-auto mb-2 ${jenis === 'pks_baru' ? 'text-orange-600' : 'text-slate-400'}`} />
            <div className="font-semibold text-sm">PKS Baru</div>
            <div className="text-xs text-slate-500 mt-1">Faskes baru kerjasama dengan BPJS</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${jenis === 'perpanjangan' ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
          onClick={() => setJenis('perpanjangan')}
        >
          <CardContent className="p-4 text-center">
            <RefreshCw className={`w-8 h-8 mx-auto mb-2 ${jenis === 'perpanjangan' ? 'text-blue-600' : 'text-slate-400'}`} />
            <div className="font-semibold text-sm">Perpanjangan PKS</div>
            <div className="text-xs text-slate-500 mt-1">PKS aktif akan berakhir (≤3 bulan)</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${jenis === 'adendum' ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-slate-300'}`}
          onClick={() => setJenis('adendum')}
        >
          <CardContent className="p-4 text-center">
            <FileEdit className={`w-8 h-8 mx-auto mb-2 ${jenis === 'adendum' ? 'text-purple-600' : 'text-slate-400'}`} />
            <div className="font-semibold text-sm">Adendum</div>
            <div className="text-xs text-slate-500 mt-1">Ubah tarif, layanan, atau data faskes</div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-pilihan Adendum */}
      {jenis === 'adendum' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jenis Adendum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                className={`p-3 rounded border cursor-pointer transition-all ${adendumSub === 'tarif' ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => setAdendumSub('tarif')}
              >
                <div className="font-semibold text-sm mb-1">Tarif</div>
                <div className="text-xs text-slate-500">Perubahan tarif layanan yang sudah ada</div>
              </div>
              <div
                className={`p-3 rounded border cursor-pointer transition-all ${adendumSub === 'layanan_baru' ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => setAdendumSub('layanan_baru')}
              >
                <div className="font-semibold text-sm mb-1">Layanan Baru</div>
                <div className="text-xs text-slate-500">Tambah layanan baru (otomatis include tarif baru)</div>
              </div>
              <div
                className={`p-3 rounded border cursor-pointer transition-all ${adendumSub === 'perubahan_data' ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => setAdendumSub('perubahan_data')}
              >
                <div className="font-semibold text-sm mb-1">Perubahan Data</div>
                <div className="text-xs text-slate-500">Ubah nama, alamat, PJ, atau bank (skip Kajian Tarif)</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-3 h-3" />
              <span>Adendum Dropping Pusat (dari kantor pusat BPJS) tidak bisa diajukan oleh faskes — CM/Kabid yang akan broadcast.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flow description */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-700" />
        <AlertDescription className="text-blue-900">
          <strong>Alur {finalJenis.replace(/_/g, ' ')}:</strong> {flowDescriptions[finalJenis]}
        </AlertDescription>
      </Alert>

      {/* Form PKS Baru */}
      {jenis === 'pks_baru' && (
        <form onSubmit={handleSubmitPksBaru} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-orange-600" /> A. Data Faskes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Nama Faskes *</Label>
                  <Input value={pksBaruForm.nama_faskes} onChange={e => setPksBaruForm(f => ({ ...f, nama_faskes: e.target.value }))} placeholder="RS Contoh, Klinik Sehat" required />
                </div>
                <div>
                  <Label>Jenis Faskes *</Label>
                  <Select value={pksBaruForm.jenis_faskes} onValueChange={v => setPksBaruForm(f => ({ ...f, jenis_faskes: v as any }))}>
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
                  <Select value={pksBaruForm.tipe_faskes} onValueChange={v => setPksBaruForm(f => ({ ...f, tipe_faskes: v as any }))}>
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
                  <Textarea value={pksBaruForm.alamat} onChange={e => setPksBaruForm(f => ({ ...f, alamat: e.target.value }))} rows={2} placeholder="Jl. ..." required />
                </div>
                <div><Label>Kota *</Label><Input value={pksBaruForm.kota} onChange={e => setPksBaruForm(f => ({ ...f, kota: e.target.value }))} required /></div>
                <div><Label>Provinsi *</Label><Input value={pksBaruForm.provinsi} onChange={e => setPksBaruForm(f => ({ ...f, provinsi: e.target.value }))} required /></div>
                <div><Label>Telepon *</Label><Input value={pksBaruForm.telp} onChange={e => setPksBaruForm(f => ({ ...f, telp: e.target.value }))} placeholder="021-1234567" required /></div>
                <div><Label>Email Faskes</Label><Input type="email" value={pksBaruForm.email_faskes} onChange={e => setPksBaruForm(f => ({ ...f, email_faskes: e.target.value }))} /></div>
                <div><Label>NPWP</Label><Input value={pksBaruForm.npwp} onChange={e => setPksBaruForm(f => ({ ...f, npwp: e.target.value }))} placeholder="01.234.567.8-901.000" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-orange-600" /> B. Penanggung Jawab</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label>Nama PJ *</Label><Input value={pksBaruForm.pj_nama} onChange={e => setPksBaruForm(f => ({ ...f, pj_nama: e.target.value }))} required /></div>
              <div><Label>Jabatan *</Label><Input value={pksBaruForm.pj_jabatan} onChange={e => setPksBaruForm(f => ({ ...f, pj_jabatan: e.target.value }))} placeholder="Direktur" required /></div>
              <div><Label>HP/Telepon *</Label><Input value={pksBaruForm.pj_phone} onChange={e => setPksBaruForm(f => ({ ...f, pj_phone: e.target.value }))} placeholder="0812..." required /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4 text-orange-600" /> C. Data Bank</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Nama Bank</Label><Input value={pksBaruForm.bank_name} onChange={e => setPksBaruForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="BRI, BNI" /></div>
              <div><Label>Cabang</Label><Input value={pksBaruForm.bank_cabang} onChange={e => setPksBaruForm(f => ({ ...f, bank_cabang: e.target.value }))} /></div>
              <div><Label>No. Rekening</Label><Input value={pksBaruForm.bank_rekening_number} onChange={e => setPksBaruForm(f => ({ ...f, bank_rekening_number: e.target.value }))} /></div>
              <div><Label>Atas Nama</Label><Input value={pksBaruForm.bank_rekening_name} onChange={e => setPksBaruForm(f => ({ ...f, bank_rekening_name: e.target.value }))} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-orange-600" /> D. Catatan</CardTitle></CardHeader>
            <CardContent><Textarea value={pksBaruForm.catatan} onChange={e => setPksBaruForm(f => ({ ...f, catatan: e.target.value }))} rows={2} placeholder="Catatan untuk CM (opsional)" /></CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700 flex-1">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</> : <><Send className="w-4 h-4 mr-2" /> Kirim Pengajuan</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
          </div>
        </form>
      )}

      {/* Form Perpanjangan */}
      {jenis === 'perpanjangan' && (
        <form onSubmit={handleSubmitPerpanjangan} className="space-y-6">
          <Alert className="bg-orange-50 border-orange-200">
            <Calendar className="w-4 h-4 text-orange-700" />
            <AlertDescription className="text-orange-900">
              <strong>Auto-clone:</strong> Data dari PKS lama akan otomatis disalin saat drafting. Anda tidak perlu input ulang data faskes.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader><CardTitle className="text-base">Pilih PKS yang Akan Diperpanjang</CardTitle></CardHeader>
            <CardContent>
              {pksList.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Tidak ada PKS aktif yang dapat diperpanjang</p>
                  <p className="text-xs text-slate-400 mt-1">PKS Anda mungkin sudah diperpanjang atau belum terdaftar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pksList.map(pks => {
                    const daysLeft = pks.tanggal_berakhir ? Math.ceil((new Date(pks.tanggal_berakhir).getTime() - Date.now()) / 86400000) : null
                    const isSelected = selectedPksId === pks.id
                    return (
                      <div
                        key={pks.id}
                        className={`p-3 rounded border cursor-pointer transition-all ${isSelected ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
                        onClick={() => setSelectedPksId(pks.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-sm">{pks.kode_pks_pihak_pertama || 'PKS'}</div>
                            <div className="text-xs text-slate-500">
                              Berakhir: {pks.tanggal_berakhir ? new Date(pks.tanggal_berakhir).toLocaleDateString('id-ID') : '-'}
                            </div>
                          </div>
                          {daysLeft !== null && (
                            <Badge className={daysLeft < 14 ? 'bg-red-100 text-red-800' : daysLeft < 30 ? 'bg-orange-100 text-orange-800' : daysLeft < 90 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                              {daysLeft} hari lagi
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Catatan (opsional)</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={perpanjanganForm.catatan}
                onChange={e => setPerpanjanganForm(f => ({ ...f, catatan: e.target.value }))}
                rows={3}
                placeholder="Contoh: Ada perubahan penanggung jawab, alamat, atau tarif..."
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !selectedPksId} className="bg-blue-700 hover:bg-blue-800 flex-1">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</> : <><Send className="w-4 h-4 mr-2" /> Kirim Pengajuan Perpanjangan</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
          </div>
        </form>
      )}

      {/* Form Adendum (Tarif / Layanan Baru / Perubahan Data) */}
      {jenis === 'adendum' && (
        <form onSubmit={handleSubmitAdendum} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-purple-600" />
                Detail Adendum {adendumSub === 'tarif' ? 'Tarif' : adendumSub === 'layanan_baru' ? 'Layanan Baru' : 'Perubahan Data'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Judul Pengajuan *</Label>
                <Input
                  value={adendumForm.judul}
                  onChange={e => setAdendumForm(f => ({ ...f, judul: e.target.value }))}
                  placeholder={
                    adendumSub === 'tarif' ? 'Contoh: Penyesuaian tarif rawat inap_kelas VIP' :
                    adendumSub === 'layanan_baru' ? 'Contoh: Penambahan layanan hemodialisa' :
                    'Contoh: Perubahan alamat faskes'
                  }
                  required
                />
              </div>
              <div>
                <Label>Deskripsi Perubahan *</Label>
                <Textarea
                  value={adendumForm.deskripsi_perubahan}
                  onChange={e => setAdendumForm(f => ({ ...f, deskripsi_perubahan: e.target.value }))}
                  rows={4}
                  placeholder={
                    adendumSub === 'tarif' ? 'Jelaskan tarif lama, tarif baru, dan alasannya (cost trend, inflasi, dll)...' :
                    adendumSub === 'layanan_baru' ? 'Jelaskan layanan baru yang diajukan + tarif usulan...' :
                    'Jelaskan perubahan data: field lama → field baru + alasan...'
                  }
                  required
                />
              </div>
              <div>
                <Label>Dokumen Pendukung (URL)</Label>
                <Input
                  value={adendumForm.dokumen_pendukung_url}
                  onChange={e => setAdendumForm(f => ({ ...f, dokumen_pendukung_url: e.target.value }))}
                  placeholder="URL ke dokumen pendukung (opsional)"
                />
                <p className="text-xs text-slate-500 mt-1">Surat permohonan resmi, rincian tarif, SK, dll.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Catatan untuk CM</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={adendumForm.catatan}
                onChange={e => setAdendumForm(f => ({ ...f, catatan: e.target.value }))}
                rows={2}
                placeholder="Catatan tambahan untuk Case Manager (opsional)"
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 flex-1">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</> : <><Send className="w-4 h-4 mr-2" /> Kirim Pengajuan Adendum</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
          </div>
        </form>
      )}
    </div>
  )
}
