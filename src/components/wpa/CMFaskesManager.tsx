'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Building2, MapPin, Phone, KeyRound, Printer, ChevronRight, Loader2, Eye, EyeOff, Copy,
  Search, Power, CheckSquare, Square, Filter, Download
} from 'lucide-react'
import { toast } from 'sonner'
import { generatePassword } from '@/lib/wpa-utils'

interface FaskesWithPIC {
  id: string
  nama: string
  jenis: string
  tipe: string | null
  status: string
  alamat: string | null
  kota: string | null
  penanggung_jawab_nama: string | null
  penanggung_jawab_phone: string | null
  wpa_user_faskes: Array<{
    is_primary: boolean
    wpa_users: {
      id: string
      email: string
      full_name: string
      phone: string | null
      is_active: boolean
      must_change_password: boolean
      temp_password: string | null
      last_login_at: string | null
    } | null
  }>
}

interface Props {
  faskesList: FaskesWithPIC[]
}

export function CMFaskesManager({ faskesList }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resetDialog, setResetDialog] = useState<{ userId: string; faskesNama: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [printLoading, setPrintLoading] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterJenis, setFilterJenis] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [bulkAction, setBulkAction] = useState<'print' | 'activate' | 'deactivate' | 'reset' | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id)
  }

  function togglePasswordVisibility(userId: string) {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }))
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
    const allPicIds = filteredList.filter(f => getPicUser(f)).map(f => f.id)
    setSelectedIds(new Set(allPicIds))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function getPicUser(f: FaskesWithPIC) {
    return (f.wpa_user_faskes || []).find(uf => uf.is_primary)?.wpa_users || null
  }

  // Filter
  const filteredList = faskesList.filter(f => {
    if (search) {
      const q = search.toLowerCase()
      if (!f.nama.toLowerCase().includes(q) && !f.kota?.toLowerCase().includes(q)) return false
    }
    if (filterJenis !== 'all' && f.jenis !== filterJenis) return false
    if (filterStatus !== 'all') {
      const pic = getPicUser(f)
      if (filterStatus === 'not_logged_in' && pic?.last_login_at) return false
      if (filterStatus === 'logged_in' && !pic?.last_login_at) return false
      if (filterStatus === 'no_pic' && pic) return false
      if (filterStatus === 'must_change' && !pic?.must_change_password) return false
    }
    return true
  })

  async function handleResetPassword() {
    if (!resetDialog) return
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password minimal 8 karakter')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: resetDialog.userId, temp_password: newPassword, must_change_password: true })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Password ${resetDialog.faskesNama} berhasil di-reset`)
      setResetDialog(null)
      setNewPassword('')
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function handlePrintCredential(userId: string) {
    setPrintLoading(userId)
    setTimeout(() => {
      window.open(`/api/print/slip-kredensial?user_id=${userId}`, '_blank')
      setPrintLoading(null)
    }, 100)
  }

  function handlePrintSelected() {
    const selected = filteredList.filter(f => selectedIds.has(f.id))
    const picIds = selected.map(f => getPicUser(f)?.id).filter(Boolean) as string[]
    if (picIds.length === 0) { toast.error('Pilih faskes yang punya PIC RS'); return }
    // Print semua terpilih dalam 1 PDF multipage
    window.open(`/api/print/slip-kredensial?user_ids=${picIds.join(',')}`, '_blank')
    toast.success(`Mencetak ${picIds.length} kredensial dalam 1 dokumen`)
  }

  async function handleBulkAction() {
    if (!bulkAction) return
    const selected = filteredList.filter(f => selectedIds.has(f.id))
    const picUsers = selected.map(f => getPicUser(f)).filter(Boolean) as any[]
    if (picUsers.length === 0) { toast.error('Pilih faskes yang punya PIC RS'); return }

    setBulkLoading(true)
    try {
      if (bulkAction === 'print') {
        window.open(`/api/print/slip-kredensial?user_ids=${picUsers.map(u => u.id).join(',')}`, '_blank')
        toast.success(`Mencetak ${picUsers.length} kredensial`)
      } else if (bulkAction === 'activate' || bulkAction === 'deactivate') {
        const isActive = bulkAction === 'activate'
        for (const u of picUsers) {
          await fetch('/api/users/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: u.id, is_active: isActive })
          })
        }
        toast.success(`${picUsers.length} PIC RS ${isActive ? 'diaktifkan' : 'dinonaktifkan'}`)
        router.refresh()
      } else if (bulkAction === 'reset') {
        for (const u of picUsers) {
          const pwd = generatePassword(12)
          await fetch('/api/users/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: u.id, temp_password: pwd, must_change_password: true })
          })
        }
        toast.success(`${picUsers.length} password PIC RS di-reset. Refresh halaman untuk lihat password baru.`)
        router.refresh()
      }
      setBulkAction(null)
      clearSelection()
    } catch (e: any) { toast.error(e.message) }
    finally { setBulkLoading(false) }
  }

  function copyCredential(email: string, password: string) {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}\nLogin: https://mitra-plkk.vercel.app`)
    toast.success('Kredensial disalin ke clipboard')
  }

  function copyAllSelected() {
    const selected = filteredList.filter(f => selectedIds.has(f.id))
    const lines = selected.map(f => {
      const pic = getPicUser(f)
      if (!pic) return null
      return `${f.nama}\t${pic.email}\t${pic.temp_password || '(sudah diganti)'}\t${pic.full_name}\t${pic.phone || ''}`
    }).filter(Boolean)
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success(`${lines.length} kredensial disalin ke clipboard (format TSV)`)
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Filter & Search Bar */}
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama faskes / kota..." className="pl-8 h-8 text-sm" />
            </div>
            <select value={filterJenis} onChange={e => setFilterJenis(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs bg-white">
              <option value="all">Semua Jenis</option>
              <option value="RS">RS</option>
              <option value="Klinik">Klinik</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs bg-white">
              <option value="all">Semua Status</option>
              <option value="not_logged_in">Belum Login</option>
              <option value="logged_in">Sudah Login</option>
              <option value="must_change">Must Change Pwd</option>
              <option value="no_pic">Tanpa PIC RS</option>
            </select>
            <div className="text-xs text-slate-500">{filteredList.length} dari {faskesList.length}</div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm"><strong>{selectedIds.size}</strong> faskes dipilih</div>
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant="outline" className="border-blue-300 text-blue-700" onClick={handlePrintSelected} disabled={bulkLoading}>
                <Printer className="w-3 h-3 mr-1" /> Print Terpilih ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction('reset')} disabled={bulkLoading}>
                <KeyRound className="w-3 h-3 mr-1" /> Reset Password
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction('activate')} disabled={bulkLoading}>
                <Power className="w-3 h-3 mr-1 text-green-600" /> Aktifkan
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction('deactivate')} disabled={bulkLoading}>
                <Power className="w-3 h-3 mr-1 text-red-600" /> Nonaktifkan
              </Button>
              <Button size="sm" variant="outline" onClick={copyAllSelected}>
                <Copy className="w-3 h-3 mr-1" /> Copy TSV
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>Batal Pilih</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={selectedIds.size === filteredList.filter(f => getPicUser(f)).length && selectedIds.size > 0}
                  onCheckedChange={() => selectedIds.size > 0 ? clearSelection() : selectAll()}
                />
              </TableHead>
              <TableHead className="w-6"></TableHead>
              <TableHead>Nama Faskes</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>PIC RS</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Tidak ada faskes yang cocok</TableCell></TableRow>
            ) : filteredList.map(f => {
              const picUser = getPicUser(f)
              const isExpanded = expandedId === f.id
              const isSelected = selectedIds.has(f.id)
              return (
                <>
                  <TableRow key={f.id} className={`cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`} onClick={() => toggleExpand(f.id)}>
                    <TableCell onClick={e => { e.stopPropagation(); if (picUser) toggleSelect(f.id) }}>
                      {picUser && <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(f.id)} />}
                    </TableCell>
                    <TableCell className="text-center">
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-700 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate max-w-[180px]">{f.nama}</div>
                          {f.alamat && <div className="text-xs text-slate-500 truncate max-w-[180px]">{f.alamat}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{f.jenis}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {picUser ? (
                        <div>
                          <div className="font-medium">{picUser.full_name}</div>
                          {picUser.phone && <div className="text-slate-400 text-[10px]">{picUser.phone}</div>}
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{picUser ? picUser.email : '-'}</TableCell>
                    <TableCell className="text-xs">
                      {picUser?.temp_password ? (
                        <div className="flex items-center gap-1">
                          <code className="bg-slate-100 px-1 rounded font-mono text-[10px]">
                            {showPasswords[picUser.id] ? picUser.temp_password : '••••••••'}
                          </code>
                          <button onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(picUser.id) }} className="text-slate-400 hover:text-slate-600">
                            {showPasswords[picUser.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : <span className="text-slate-400 text-[10px]">diganti</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge className={f.status === 'aktif' ? 'bg-green-100 text-green-800 text-[10px]' : 'bg-slate-100 text-slate-600 text-[10px]'}>{f.status}</Badge>
                        {picUser?.must_change_password && <Badge className="bg-yellow-100 text-yellow-800 text-[9px]">Must Change</Badge>}
                        {picUser?.last_login_at && <Badge className="bg-blue-100 text-blue-800 text-[9px]">Login</Badge>}
                        {picUser && !picUser.is_active && <Badge className="bg-red-100 text-red-800 text-[9px]">Nonaktif</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        {picUser && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePrintCredential(picUser.id)} title="Print Kredensial">
                              {printLoading === picUser.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3 text-blue-600" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setResetDialog({ userId: picUser.id, faskesNama: f.nama }); setNewPassword(generatePassword(12)) }} title="Reset Password">
                              <KeyRound className="w-3 h-3 text-orange-600" />
                            </Button>
                            {picUser.temp_password && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyCredential(picUser.email, picUser.temp_password!)} title="Copy Kredensial">
                                <Copy className="w-3 h-3 text-slate-600" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={f.id + '-detail'} className="bg-slate-50">
                      <TableCell colSpan={9} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="font-semibold text-xs text-slate-500 uppercase mb-1">Data Faskes</div>
                            <div className="space-y-1 text-xs">
                              <div><strong>Nama:</strong> {f.nama}</div>
                              <div><strong>Jenis:</strong> {f.jenis} {f.tipe && f.tipe !== '-' ? `Tipe ${f.tipe}` : ''}</div>
                              <div className="flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /><span>{f.alamat || '-'}</span></div>
                              <div><strong>Kota:</strong> {f.kota || '-'}</div>
                              <div><strong>PJ:</strong> {f.penanggung_jawab_nama || '-'}</div>
                              {f.penanggung_jawab_phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{f.penanggung_jawab_phone}</div>}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-slate-500 uppercase mb-1">PIC RS</div>
                            {picUser ? (
                              <div className="space-y-1 text-xs">
                                <div><strong>Nama:</strong> {picUser.full_name}</div>
                                <div><strong>Email:</strong> {picUser.email}</div>
                                <div><strong>Phone:</strong> {picUser.phone || '-'}</div>
                                <div><strong>Status:</strong> {picUser.is_active ? 'Aktif' : 'Nonaktif'}</div>
                                <div><strong>Last Login:</strong> {picUser.last_login_at ? new Date(picUser.last_login_at).toLocaleString('id-ID') : 'Belum pernah'}</div>
                                <div><strong>Must Change:</strong> {picUser.must_change_password ? 'Ya' : 'Tidak'}</div>
                              </div>
                            ) : <p className="text-xs text-slate-400">Belum ada PIC RS</p>}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-slate-500 uppercase mb-1">Aksi</div>
                            <div className="flex flex-col gap-1">
                              {picUser && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handlePrintCredential(picUser.id)}>
                                    <Printer className="w-3 h-3 mr-1" /> Print Kredensial
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => { setResetDialog({ userId: picUser.id, faskesNama: f.nama }); setNewPassword(generatePassword(12)) }}>
                                    <KeyRound className="w-3 h-3 mr-1" /> Reset Password
                                  </Button>
                                  {picUser.temp_password && (
                                    <Button size="sm" variant="outline" onClick={() => copyCredential(picUser.email, picUser.temp_password!)}>
                                      <Copy className="w-3 h-3 mr-1" /> Copy Kredensial
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={async () => {
                                    await fetch('/api/users/update', {
                                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ user_id: picUser.id, is_active: !picUser.is_active })
                                    })
                                    toast.success(`PIC RS ${!picUser.is_active ? 'diaktifkan' : 'dinonaktifkan'}`)
                                    router.refresh()
                                  }}>
                                    <Power className={`w-3 h-3 mr-1 ${picUser.is_active ? 'text-red-600' : 'text-green-600'}`} />
                                    {picUser.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetDialog} onOpenChange={(o) => { if (!o) { setResetDialog(null); setNewPassword('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-orange-600" /> Reset Password PIC RS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-2 bg-slate-50 rounded text-sm">
              <Building2 className="w-4 h-4 inline mr-1" /> {resetDialog?.faskesNama}
            </div>
            <div>
              <Label>Password Baru</Label>
              <div className="flex gap-2">
                <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} className="font-mono" />
                <Button variant="outline" size="sm" onClick={() => setNewPassword(generatePassword(12))}>Generate</Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">PIC RS harus ganti password ini saat login berikutnya.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetDialog(null); setNewPassword('') }}>Batal</Button>
            <Button onClick={handleResetPassword} disabled={loading || newPassword.length < 8}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Confirm Dialog */}
      <Dialog open={!!bulkAction} onOpenChange={(o) => { if (!o) setBulkAction(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Bulk Action</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            {bulkAction === 'reset' && <p>Reset password untuk <strong>{selectedIds.size}</strong> PIC RS? Password baru akan di-generate otomatis. Setiap PIC RS wajib ganti password saat login.</p>}
            {bulkAction === 'activate' && <p>Aktifkan <strong>{selectedIds.size}</strong> PIC RS?</p>}
            {bulkAction === 'deactivate' && <p>Nonaktifkan <strong>{selectedIds.size}</strong> PIC RS? Mereka tidak bisa login sampai diaktifkan kembali.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>Batal</Button>
            <Button onClick={handleBulkAction} disabled={bulkLoading} className={bulkAction === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'}>
              {bulkLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
