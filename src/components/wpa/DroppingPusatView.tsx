'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Send, FileEdit, Building2, Info, CheckCircle2, AlertCircle, Search, ListChecks } from 'lucide-react'
import { toast } from 'sonner'

interface FaskesItem {
  id: string
  nama: string
  jenis: string
  tipe: string
  kota: string
  status: string
  pks_id: string | null
  pks_kode: string | null
  pks_berakhir: string | null
  has_active_pks: boolean
}

interface ExcludeEntry {
  faskes_id: string
  alasan: string
}

interface Props {
  role: 'case_manager' | 'kepala_bidang'
}

export function DroppingPusatView({ role }: Props) {
  const [loading, setLoading] = useState(false)
  const [fetchingList, setFetchingList] = useState(true)
  const [faskesList, setFaskesList] = useState<FaskesItem[]>([])
  const [search, setSearch] = useState('')
  const [filterJenis, setFilterJenis] = useState<string>('all')

  // Form batch
  const [batchForm, setBatchForm] = useState({
    no_surat_pusat: '',
    tanggal_surat_pusat: new Date().toISOString().slice(0, 10),
    perihal: '',
    surat_acuan_url: '',
    catatan: '',
  })

  // Hybrid state: default semua ON (true), bisa di-uncheck (false)
  // Map: faskes_id → checked (boolean)
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({})
  const [exclusions, setExclusions] = useState<Record<string, string>>({}) // faskes_id → alasan

  // Modal for uncheck reason
  const [uncheckModal, setUncheckModal] = useState<{ faskesId: string; faskesNama: string } | null>(null)
  const [uncheckAlasan, setUncheckAlasan] = useState('')

  // Success modal
  const [successInfo, setSuccessInfo] = useState<{ total_diproses: number; total_dikecualikan: number } | null>(null)

  useEffect(() => {
    fetchFaskes()
  }, [])

  async function fetchFaskes() {
    setFetchingList(true)
    try {
      const res = await fetch('/api/dropping-pusat/faskes-list')
      const data = await res.json()
      if (res.ok) {
        const list = data.data || []
        setFaskesList(list)
        // Default: semua checked = true (Hybrid fail-safe — semua dapat, bisa uncheck)
        const init: Record<string, boolean> = {}
        list.forEach((f: FaskesItem) => { init[f.id] = true })
        setCheckedMap(init)
      } else {
        toast.error(data.error)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setFetchingList(false)
    }
  }

  function handleToggle(faskesId: string, faskesNama: string, checked: boolean) {
    if (checked) {
      // Re-check → remove from exclusions
      const newChecked = { ...checkedMap, [faskesId]: true }
      const newExclusions = { ...exclusions }
      delete newExclusions[faskesId]
      setCheckedMap(newChecked)
      setExclusions(newExclusions)
    } else {
      // Uncheck → open modal to capture reason
      setUncheckModal({ faskesId, faskesNama })
      setUncheckAlasan(exclusions[faskesId] || '')
    }
  }

  function confirmUncheck() {
    if (!uncheckModal) return
    if (uncheckAlasan.trim().length < 5) {
      toast.error('Alasan minimal 5 karakter')
      return
    }
    setCheckedMap(prev => ({ ...prev, [uncheckModal.faskesId]: false }))
    setExclusions(prev => ({ ...prev, [uncheckModal.faskesId]: uncheckAlasan.trim() }))
    setUncheckModal(null)
    setUncheckAlasan('')
  }

  function cancelUncheck() {
    setUncheckModal(null)
    setUncheckAlasan('')
  }

  function selectAll() {
    const all: Record<string, boolean> = {}
    filteredList.forEach(f => { all[f.id] = true })
    setCheckedMap(prev => ({ ...prev, ...all }))
    // Remove exclusions for these
    const newExcl = { ...exclusions }
    filteredList.forEach(f => { delete newExcl[f.id] })
    setExclusions(newExcl)
  }

  function deselectAll() {
    // For filtered list only — set all to false, prompt for reason in bulk
    if (!confirm(`Anda yakin uncheck ${filteredList.length} faskes? Anda harus isi alasan untuk masing-masing.`)) return
    // Just trigger the modal for the first one; user can repeat
    if (filteredList.length > 0) {
      const first = filteredList[0]
      handleToggle(first.id, first.nama, false)
    }
  }

  // Filter list
  const filteredList = faskesList.filter(f => {
    if (filterJenis !== 'all' && f.jenis !== filterJenis) return false
    if (search && !f.nama.toLowerCase().includes(search.toLowerCase()) && !f.kota.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const selectedCount = Object.values(checkedMap).filter(v => v === true).length
  const excludedCount = Object.keys(exclusions).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batchForm.no_surat_pusat || !batchForm.perihal || !batchForm.tanggal_surat_pusat) {
      toast.error('No. surat, tanggal, dan perihal wajib diisi')
      return
    }
    if (selectedCount === 0) {
      toast.error('Minimal 1 faskes harus dipilih')
      return
    }
    // Final validation: every exclusion must have alasan ≥ 5 chars
    const excludeArr: ExcludeEntry[] = Object.entries(exclusions).map(([faskes_id, alasan]) => ({ faskes_id, alasan }))
    for (const ex of excludeArr) {
      if (ex.alasan.trim().length < 5) {
        toast.error('Ada faskes yang di-uncheck tanpa alasan. Klik kembali untuk isi alasan.')
        return
      }
    }
    const selectedIds = Object.entries(checkedMap).filter(([_, v]) => v === true).map(([k]) => k)

    setLoading(true)
    try {
      const res = await fetch('/api/dropping-pusat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...batchForm,
          selected_faskes_ids: selectedIds,
          exclusions: excludeArr,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccessInfo({ total_diproses: data.total_diproses, total_dikecualikan: data.total_dikecualikan })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (fetchingList) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileEdit className="w-6 h-6 text-purple-600" />
          Adendum Dropping Pusat
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {role === 'case_manager'
            ? 'Broadcast adendum dari kantor pusat BPJS ke faskes di cabang Anda. Default semua faskes aktif akan diproses — uncheck yang tidak relevan + wajib isi alasan.'
            : 'Sebagai Kabid, Anda juga bisa broadcast Dropping Pusat. Default semua faskes aktif akan diproses — uncheck yang tidak relevan + wajib isi alasan.'}
        </p>
      </div>

      <Alert className="bg-cyan-50 border-cyan-200">
        <Info className="w-4 h-4 text-cyan-700" />
        <AlertDescription className="text-cyan-900">
          <strong>Hybrid Mode (Fail-Safe):</strong> Semua faskes ber-PKS aktif sudah tercentang secara default. 
          Jika semua relevan → langsung submit. Jika ada yang tidak relevan (mis. adendum ICU untuk klinik) → uncheck + isi alasan. 
          Alasan exclude akan tercatat untuk audit BPJS pusat.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Batch Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">A. Data Surat dari Kantor Pusat</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>No. Surat Pusat *</Label>
              <Input
                value={batchForm.no_surat_pusat}
                onChange={e => setBatchForm(f => ({ ...f, no_surat_pusat: e.target.value }))}
                placeholder="Contoh: SURAT/BPJSK/2026/001"
                required
              />
            </div>
            <div>
              <Label>Tanggal Surat *</Label>
              <Input
                type="date"
                value={batchForm.tanggal_surat_pusat}
                onChange={e => setBatchForm(f => ({ ...f, tanggal_surat_pusat: e.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label>Perihal Perubahan *</Label>
              <Input
                value={batchForm.perihal}
                onChange={e => setBatchForm(f => ({ ...f, perihal: e.target.value }))}
                placeholder="Contoh: Perubahan ayat 4.c tentang Tarif Inap"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label>URL Surat Acuan (opsional)</Label>
              <Input
                value={batchForm.surat_acuan_url}
                onChange={e => setBatchForm(f => ({ ...f, surat_acuan_url: e.target.value }))}
                placeholder="URL ke PDF surat dari pusat"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Catatan Internal (opsional)</Label>
              <Textarea
                value={batchForm.catatan}
                onChange={e => setBatchForm(f => ({ ...f, catatan: e.target.value }))}
                rows={2}
                placeholder="Catatan untuk diri sendiri / tim cabang"
              />
            </div>
          </CardContent>
        </Card>

        {/* Faskes List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-purple-600" />
                B. Pilih Faskes Target
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">{selectedCount} akan diproses</Badge>
                <Badge className="bg-red-100 text-red-800">{excludedCount} dikecualikan</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filter & Search */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama faskes / kota..."
                  className="pl-8"
                />
              </div>
              <select
                value={filterJenis}
                onChange={e => setFilterJenis(e.target.value)}
                className="border border-slate-200 rounded px-3 py-2 text-sm bg-white"
              >
                <option value="all">Semua Jenis</option>
                <option value="RS">RS</option>
                <option value="Klinik">Klinik</option>
                <option value="Puskesmas">Puskesmas</option>
                <option value="PraktikMandiri">Praktik Mandiri</option>
              </select>
              <Button type="button" size="sm" variant="outline" onClick={selectAll}>Pilih Semua</Button>
              <Button type="button" size="sm" variant="outline" onClick={deselectAll}>Batal Pilih (filtered)</Button>
            </div>

            {/* Faskes Checklist */}
            {faskesList.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Tidak ada faskes ber-PKS aktif di cabang Anda.</p>
                <p className="text-xs text-slate-400 mt-1">Dropping Pusat hanya berlaku untuk faskes yang sudah memiliki PKS ditandatangani.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded">
                {filteredList.map(f => {
                  const isChecked = checkedMap[f.id] === true
                  const alasan = exclusions[f.id]
                  return (
                    <div
                      key={f.id}
                      className={`flex items-start gap-3 p-3 border-b border-slate-100 last:border-0 transition-colors ${isChecked ? 'bg-white' : 'bg-red-50'}`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => handleToggle(f.id, f.nama, v === true)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-sm text-slate-900">{f.nama}</span>
                          <Badge variant="outline">{f.jenis}{f.tipe && f.jenis === 'RS' ? ` ${f.tipe}` : ''}</Badge>
                          <span className="text-xs text-slate-500">{f.kota}</span>
                          {f.pks_kode && (
                            <Badge variant="outline" className="text-[10px]">PKS: {f.pks_kode}</Badge>
                          )}
                        </div>
                        {!isChecked && alasan && (
                          <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-900">
                            <strong>Alasan exclude:</strong> {alasan}
                          </div>
                        )}
                        {!isChecked && !alasan && (
                          <div className="mt-2 p-2 bg-yellow-100 border border-yellow-200 rounded text-xs text-yellow-900">
                            ⚠ Alasan belum diisi — klik kembali checkbox untuk isi alasan.
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {filteredList.length === 0 && (
                  <div className="p-6 text-center text-sm text-slate-500">
                    Tidak ada faskes yang cocok dengan filter.
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-sm">
                <strong className="text-slate-900">{selectedCount} faskes</strong> akan menerima adendum ini.
                {excludedCount > 0 && (
                  <span className="text-slate-600"> · {excludedCount} dikecualikan (alasan tercatat).</span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Total faskes ber-PKS: {faskesList.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || selectedCount === 0} className="bg-purple-600 hover:bg-purple-700 flex-1">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat pipeline...</> : <><Send className="w-4 h-4 mr-2" /> Broadcast ke {selectedCount} Faskes</>}
          </Button>
        </div>
      </form>

      {/* Uncheck Reason Modal */}
      <Dialog open={!!uncheckModal} onOpenChange={(o) => { if (!o) cancelUncheck() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alasan Exclude Faskes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded text-sm">
              <Building2 className="w-4 h-4 inline mr-1 text-slate-500" />
              <strong>{uncheckModal?.faskesNama}</strong>
            </div>
            <div>
              <Label>Alasan mengapa faskes ini tidak perlu adendum? *</Label>
              <Textarea
                value={uncheckAlasan}
                onChange={e => setUncheckAlasan(e.target.value)}
                rows={3}
                placeholder="Contoh: Adendum ini tentang tarif ICU, faskes ini klinik tingkat 1 tanpa layanan rawat inap."
              />
              <p className="text-xs text-slate-500 mt-1">Alasan ini tercatat untuk audit BPJS pusat.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelUncheck}>Batal</Button>
            <Button onClick={confirmUncheck} disabled={uncheckAlasan.trim().length < 5}>Konfirmasi Exclude</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={!!successInfo} onOpenChange={(o) => { if (!o) setSuccessInfo(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              Dropping Pusat Berhasil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Adendum berhasil di-broadcast:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded text-center">
                <div className="text-2xl font-bold text-green-800">{successInfo?.total_diproses}</div>
                <div className="text-xs text-green-700">Faskes Diproses</div>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded text-center">
                <div className="text-2xl font-bold text-red-800">{successInfo?.total_dikecualikan}</div>
                <div className="text-xs text-red-700">Dikecualikan</div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              PIC RS dari setiap faskes yang diproses akan menerima notifikasi. Mereka bisa tracking status di menu "Pengajuan Saya". Pipeline akan masuk ke Tugas Saya (CM/Kabid) untuk drafting adendum per faskes.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setSuccessInfo(null); window.location.reload() }}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
