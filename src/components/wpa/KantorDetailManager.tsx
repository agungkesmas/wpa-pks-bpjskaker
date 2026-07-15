'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Building2, Users, FileSignature, BarChart3, ArrowLeft, Plus, KeyRound, 
  Power, Printer, ArrowRightLeft, Edit, Save, X, ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import { ROLE_LABELS, type UserRole } from '@/lib/auth-constants'
import { generatePassword } from '@/lib/wpa-utils'

interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone: string | null
  nip: string | null
  profile_photo_url: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  must_change_password: boolean
  temp_password: string | null
  mutasi_pending: any
}

interface Faskes {
  id: string
  nama: string
  jenis: string
  tipe: string
  status: string
  alamat: string | null
  kota: string | null
  group_id: string | null
  wpa_faskes_group: { nama: string } | null
}

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
  created_at: string
}

interface Props {
  kantor: Kantor
  users: User[]
  faskes: Faskes[]
  allKantor: { id: string; nama: string; kode: string }[]
  stats: { users: number; faskes: number; pks_aktif: number; pks_draft: number; pks_berakhir: number }
  canEdit: boolean
  canCreateUser: boolean
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-rose-100 text-rose-800',
  case_manager: 'bg-blue-100 text-blue-800',
  kepala_bidang: 'bg-teal-100 text-teal-800',
  penata_pelayanan: 'bg-cyan-100 text-cyan-800',
  pic_rs: 'bg-orange-100 text-orange-800',
  legal_rs: 'bg-purple-100 text-purple-800',
}

export function KantorDetailManager({ kantor, users, faskes, allKantor, stats, canEdit, canCreateUser }: Props) {
  const router = useRouter()
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({
    nama: kantor.nama, alamat: kantor.alamat || '', kota: kantor.kota || '',
    provinsi: kantor.provinsi || '', telp: kantor.telp || '', email: kantor.email || '',
    is_active: kantor.is_active
  })
  const [savingInfo, setSavingInfo] = useState(false)
  
  // User dialog state
  const [userDialog, setUserDialog] = useState(false)
  const [userForm, setUserForm] = useState({
    email: '', full_name: '', role: 'case_manager' as UserRole, phone: '', nip: '', password: ''
  })
  const [creatingUser, setCreatingUser] = useState(false)
  const [createdPwd, setCreatedPwd] = useState<string | null>(null)
  
  // Mutasi dialog
  const [mutasiDialog, setMutasiDialog] = useState<User | null>(null)
  const [mutasiForm, setMutasiForm] = useState({
    to_kantor_cabang_id: '', tanggal_sk: new Date().toISOString().split('T')[0],
    tanggal_efektif: new Date().toISOString().split('T')[0], nomor_sk: '', alasan: '', mode: 'scheduled' as 'instant' | 'scheduled'
  })
  const [mutasiLoading, setMutasiLoading] = useState(false)
  
  // Print dialogs
  const [printDialog, setPrintDialog] = useState<User | null>(null)
  
  async function saveInfo() {
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/kantor/${kantor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(infoForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Info kantor diperbarui')
      setEditingInfo(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingInfo(false)
    }
  }
  
  async function createUser() {
    setCreatingUser(true)
    try {
      const pwd = userForm.password || generatePassword(12)
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userForm.email.toLowerCase(),
          full_name: userForm.full_name,
          role: userForm.role,
          phone: userForm.phone || undefined,
          nip: userForm.nip || undefined,
          password: pwd,
          kantor_cabang_id: kantor.id,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      // Simpan temp_password ke DB untuk ditampilkan di Slip Kredensial
      await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.user.id, temp_password: pwd, must_change_password: true })
      })
      
      setCreatedPwd(pwd)
      toast.success(`User "${userForm.full_name}" berhasil dibuat`)
      setUserDialog(false)
      setUserForm({ email: '', full_name: '', role: 'case_manager', phone: '', nip: '', password: '' })
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreatingUser(false)
    }
  }
  
  async function toggleUserActive(user: User) {
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, is_active: !user.is_active })
      })
      if (!res.ok) throw new Error('Gagal update')
      toast.success(`User ${!user.is_active ? 'diaktifkan' : 'dinonaktifkan'}`)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  
  async function resetPassword(user: User) {
    if (!confirm(`Reset password untuk ${user.full_name}?`)) return
    try {
      const pwd = generatePassword(12)
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, password: pwd, must_change_password: true, temp_password: pwd })
      })
      if (!res.ok) throw new Error('Gagal reset')
      setCreatedPwd(pwd)
      toast.success('Password berhasil direset')
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  
  async function submitMutasi() {
    if (!mutasiDialog) return
    setMutasiLoading(true)
    try {
      const res = await fetch('/api/mutasi/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: mutasiDialog.id,
          ...mutasiForm,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Mutasi ${mutasiForm.mode === 'instant' ? 'langsung diterapkan' : 'dijadwalkan'} untuk ${mutasiDialog.full_name}`)
      setMutasiDialog(null)
      setMutasiForm({ to_kantor_cabang_id: '', tanggal_sk: new Date().toISOString().split('T')[0], tanggal_efektif: new Date().toISOString().split('T')[0], nomor_sk: '', alasan: '', mode: 'scheduled' })
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setMutasiLoading(false)
    }
  }
  
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  
  function toggleSelectUser(userId: string) {
    setSelectedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }
  
  function toggleSelectAll() {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }
  
  function printKredensial(user?: User) {
    if (user) {
      window.open(`/api/print/slip-kredensial?user_id=${user.id}`, '_blank')
    } else {
      window.open(`/api/print/slip-kredensial?kantor_cabang_id=${kantor.id}`, '_blank')
    }
  }
  
  function printSelected() {
    // Print each selected user's slip in sequence
    const ids = Array.from(selectedUsers)
    if (ids.length === 0) return
    // For batch: use kantor_cabang_id (prints all active users)
    // For specific selected: open each in sequence
    if (ids.length === users.length) {
      printKredensial()
    } else {
      ids.forEach((id, i) => {
        setTimeout(() => window.open(`/api/print/slip-kredensial?user_id=${id}`, '_blank'), i * 500)
      })
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Back link + Title */}
      <div>
        <Link href="/super_admin/kantor" className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Kembali ke daftar kantor
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-rose-700" />
              {kantor.nama}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Kode: <span className="font-mono">{kantor.kode}</span> · {kantor.kota || '-'}
            </p>
          </div>
          <Badge variant={kantor.is_active ? 'default' : 'destructive'} className={kantor.is_active ? 'bg-green-100 text-green-800' : ''}>
            {kantor.is_active ? 'Aktif' : 'Nonaktif'}
          </Badge>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3">
          <Users className="w-4 h-4 text-slate-700 mb-1" />
          <div className="text-xl font-bold text-slate-900">{stats.users}</div>
          <div className="text-[10px] text-slate-500">User Aktif</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <Building2 className="w-4 h-4 text-orange-700 mb-1" />
          <div className="text-xl font-bold text-slate-900">{stats.faskes}</div>
          <div className="text-[10px] text-slate-500">Faskes Aktif</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <ShieldCheck className="w-4 h-4 text-green-700 mb-1" />
          <div className="text-xl font-bold text-green-700">{stats.pks_aktif}</div>
          <div className="text-[10px] text-slate-500">PKS Aktif</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <FileSignature className="w-4 h-4 text-yellow-700 mb-1" />
          <div className="text-xl font-bold text-yellow-700">{stats.pks_draft}</div>
          <div className="text-[10px] text-slate-500">PKS Draft</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <FileSignature className="w-4 h-4 text-red-700 mb-1" />
          <div className="text-xl font-bold text-red-700">{stats.pks_berakhir}</div>
          <div className="text-[10px] text-slate-500">PKS Berakhir</div>
        </CardContent></Card>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users"><Users className="w-3 h-3 mr-1" /> User ({users.length})</TabsTrigger>
          <TabsTrigger value="info"><Building2 className="w-3 h-3 mr-1" /> Info Kantor</TabsTrigger>
          <TabsTrigger value="faskes"><Building2 className="w-3 h-3 mr-1" /> Faskes ({faskes.length})</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="w-3 h-3 mr-1" /> Statistik</TabsTrigger>
        </TabsList>
        
        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => printKredensial()}>
                <Printer className="w-3 h-3 mr-1" /> Print Semua Kredensial
              </Button>
              {selectedUsers.size > 0 && (
                <Button variant="outline" size="sm" className="border-blue-300 text-blue-700" onClick={printSelected}>
                  <Printer className="w-3 h-3 mr-1" /> Print Terpilih ({selectedUsers.size})
                </Button>
              )}
            </div>
            {canCreateUser && (
              <Dialog open={userDialog} onOpenChange={setUserDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-rose-700 hover:bg-rose-800">
                    <Plus className="w-3 h-3 mr-1" /> Tambah User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tambah User di {kantor.nama}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createUser() }} className="space-y-3">
                    <div>
                      <Label>Nama Lengkap *</Label>
                      <Input value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))} required />
                    </div>
                    <div>
                      <Label>NIP</Label>
                      <Input value={userForm.nip} onChange={e => setUserForm(f => ({ ...f, nip: e.target.value }))} placeholder="19851234 200804 1 001" />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} required />
                    </div>
                    <div>
                      <Label>Role *</Label>
                      <Select value={userForm.role} onValueChange={(v: UserRole) => setUserForm(f => ({ ...f, role: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).filter(([r]) => r !== 'super_admin').map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>No. Telepon</Label>
                      <Input value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Password (kosongkan untuk auto-generate)</Label>
                      <Input type="text" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Auto-generate" />
                    </div>
                    <p className="text-xs text-slate-500">User akan otomatis terikat ke kantor: <strong>{kantor.nama}</strong></p>
                    <Button type="submit" disabled={creatingUser} className="w-full">
                      {creatingUser ? 'Menyimpan...' : 'Buat User'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"><Checkbox checked={selectedUsers.size === users.length && users.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Login Terakhir</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                        Belum ada user di kantor ini
                      </TableCell>
                    </TableRow>
                  ) : users.map(u => {
                    const initials = u.full_name.split(' ').map(w => w.charAt(0)).slice(0,2).join('').toUpperCase()
                    return (
                      <TableRow key={u.id}>
                        <TableCell><Checkbox checked={selectedUsers.has(u.id)} onCheckedChange={() => toggleSelectUser(u.id)} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              {u.profile_photo_url ? (
                                <img src={u.profile_photo_url} alt={u.full_name} className="w-full h-full object-cover rounded-full" />
                              ) : (
                                <AvatarFallback className={ROLE_COLORS[u.role]}>{initials}</AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{u.full_name}</div>
                              <div className="text-xs text-slate-500">{u.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                        </TableCell>
                        <TableCell>
                          {u.temp_password ? (
                            <span className="font-mono text-xs bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded text-yellow-800">{u.temp_password}</span>
                          ) : (
                            <span className="text-xs text-slate-400">•••••• (sudah diganti)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Belum pernah'}
                        </TableCell>
                        <TableCell>
                          {u.is_active ? (
                            <Badge className="bg-green-100 text-green-800">Aktif</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Nonaktif</Badge>
                          )}
                          {u.must_change_password && (
                            <Badge className="bg-yellow-100 text-yellow-800 ml-1">Pwd Baru</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.mutasi_pending ? (
                            <Badge className="bg-blue-100 text-blue-800" title={`Efektif: ${u.mutasi_pending.tanggal_efektif}`}>
                              → {u.mutasi_pending.tanggal_efektif}
                            </Badge>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => resetPassword(u)} title="Reset Password">
                              <KeyRound className="w-3 h-3 text-orange-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMutasiDialog(u)} title="Mutasi">
                              <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printKredensial(u)} title="Print Kredensial">
                              <Printer className="w-3 h-3 text-slate-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleUserActive(u)} title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                              <Power className={`w-3 h-3 ${u.is_active ? 'text-red-600' : 'text-green-600'}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* INFO TAB */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Informasi Kantor Cabang</span>
                {canEdit && !editingInfo && (
                  <Button size="sm" variant="outline" onClick={() => setEditingInfo(true)}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                )}
                {editingInfo && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={saveInfo} disabled={savingInfo}>
                      <Save className="w-3 h-3 mr-1" /> {savingInfo ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingInfo(false)}>
                      <X className="w-3 h-3 mr-1" /> Batal
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Kode Kantor</Label>
                  <div className="font-mono">{kantor.kode}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Nama Kantor</Label>
                  {editingInfo ? (
                    <Input value={infoForm.nama} onChange={e => setInfoForm(f => ({ ...f, nama: e.target.value }))} />
                  ) : (
                    <div className="font-medium">{kantor.nama}</div>
                  )}
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-slate-500">Alamat</Label>
                  {editingInfo ? (
                    <Textarea value={infoForm.alamat} onChange={e => setInfoForm(f => ({ ...f, alamat: e.target.value }))} rows={2} />
                  ) : (
                    <div>{kantor.alamat || '-'}</div>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Kota</Label>
                  {editingInfo ? (
                    <Input value={infoForm.kota} onChange={e => setInfoForm(f => ({ ...f, kota: e.target.value }))} />
                  ) : (
                    <div>{kantor.kota || '-'}</div>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Provinsi</Label>
                  {editingInfo ? (
                    <Input value={infoForm.provinsi} onChange={e => setInfoForm(f => ({ ...f, provinsi: e.target.value }))} />
                  ) : (
                    <div>{kantor.provinsi || '-'}</div>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Telepon</Label>
                  {editingInfo ? (
                    <Input value={infoForm.telp} onChange={e => setInfoForm(f => ({ ...f, telp: e.target.value }))} />
                  ) : (
                    <div>{kantor.telp || '-'}</div>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Email</Label>
                  {editingInfo ? (
                    <Input value={infoForm.email} onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))} />
                  ) : (
                    <div>{kantor.email || '-'}</div>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Label className="text-xs text-slate-500">Status Aktif:</Label>
                  {editingInfo ? (
                    <Switch checked={infoForm.is_active} onCheckedChange={c => setInfoForm(f => ({ ...f, is_active: c }))} />
                  ) : (
                    <Badge variant={kantor.is_active ? 'default' : 'destructive'} className={kantor.is_active ? 'bg-green-100 text-green-800' : ''}>
                      {kantor.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* FASKES TAB */}
        <TabsContent value="faskes">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Faskes</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Grup</TableHead>
                    <TableHead>Kota</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faskes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                        Belum ada faskes terdaftar
                      </TableCell>
                    </TableRow>
                  ) : faskes.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nama}</TableCell>
                      <TableCell><Badge variant="outline">{f.jenis}</Badge></TableCell>
                      <TableCell>{f.tipe !== '-' && <Badge variant="outline">Tipe {f.tipe}</Badge>}</TableCell>
                      <TableCell className="text-xs">{f.wpa_faskes_group?.nama || '-'}</TableCell>
                      <TableCell className="text-xs">{f.kota || '-'}</TableCell>
                      <TableCell>
                        <Badge className={f.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>
                          {f.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* STATISTIK TAB */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Ringkasan Sumber Daya</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between"><span className="text-sm">Total User Aktif</span><Badge>{stats.users}</Badge></div>
                <div className="flex justify-between"><span className="text-sm">Total Faskes Aktif</span><Badge>{stats.faskes}</Badge></div>
                <div className="flex justify-between"><span className="text-sm">PKS Aktif (ditandatangani)</span><Badge className="bg-green-100 text-green-800">{stats.pks_aktif}</Badge></div>
                <div className="flex justify-between"><span className="text-sm">PKS Draft (in progress)</span><Badge className="bg-yellow-100 text-yellow-800">{stats.pks_draft}</Badge></div>
                <div className="flex justify-between"><span className="text-sm">PKS Berakhir</span><Badge className="bg-red-100 text-red-800">{stats.pks_berakhir}</Badge></div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader><CardTitle className="text-base">Dibuat Pada</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Kantor cabang ini terdaftar sejak:
                </p>
                <p className="text-lg font-semibold">
                  {new Date(kantor.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  ID: <span className="font-mono">{kantor.id}</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Modal Mutasi */}
      <Dialog open={!!mutasiDialog} onOpenChange={(o) => !o && setMutasiDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mutasi User: {mutasiDialog?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded text-xs">
              <div>Email: <strong>{mutasiDialog?.email}</strong></div>
              <div>Role: <strong>{mutasiDialog ? ROLE_LABELS[mutasiDialog.role] : ''}</strong></div>
              <div>Asal: <strong>{kantor.nama}</strong></div>
            </div>
            <div>
              <Label>Pindah ke Kantor *</Label>
              <Select value={mutasiForm.to_kantor_cabang_id} onValueChange={v => setMutasiForm(f => ({ ...f, to_kantor_cabang_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih kantor tujuan" /></SelectTrigger>
                <SelectContent>
                  {allKantor.map(k => <SelectItem key={k.id} value={k.id}>{k.nama} ({k.kode})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal SK</Label>
                <Input type="date" value={mutasiForm.tanggal_sk} onChange={e => setMutasiForm(f => ({ ...f, tanggal_sk: e.target.value }))} />
              </div>
              <div>
                <Label>Tanggal Efektif *</Label>
                <Input type="date" value={mutasiForm.tanggal_efektif} onChange={e => setMutasiForm(f => ({ ...f, tanggal_efektif: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Nomor SK</Label>
              <Input value={mutasiForm.nomor_sk} onChange={e => setMutasiForm(f => ({ ...f, nomor_sk: e.target.value }))} placeholder="SK-123/..." />
            </div>
            <div>
              <Label>Alasan Mutasi</Label>
              <Textarea value={mutasiForm.alasan} onChange={e => setMutasiForm(f => ({ ...f, alasan: e.target.value }))} rows={2} placeholder="Rotasi, mutasi, promosi, dll" />
            </div>
            <div>
              <Label>Mode Mutasi</Label>
              <Select value={mutasiForm.mode} onValueChange={(v: any) => setMutasiForm(f => ({ ...f, mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled (auto-apply di tanggal efektif)</SelectItem>
                  <SelectItem value="instant">Instan (langsung pindah hari ini)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={submitMutasi} disabled={mutasiLoading || !mutasiForm.to_kantor_cabang_id} className="w-full">
              {mutasiLoading ? 'Memproses...' : 'Proses Mutasi'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal tampilkan password hasil create/reset */}
      {createdPwd && (
        <Dialog open={!!createdPwd} onOpenChange={() => setCreatedPwd(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Password Sementara</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Bagikan password ini ke user melalui kanal aman (WhatsApp/email pribadi). 
                User akan diminta ganti password setelah login pertama.
              </p>
              <div className="bg-slate-100 rounded p-3 font-mono text-sm break-all">
                {createdPwd}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  navigator.clipboard.writeText(createdPwd)
                  toast.success('Password disalin')
                }}>
                  Copy Password
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => printKredensial()}>
                  <Printer className="w-3 h-3 mr-1" /> Print Kredensial
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
