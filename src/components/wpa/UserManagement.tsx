'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, KeyRound, Trash2, Power, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { generatePassword } from '@/lib/wpa-utils'

type Role = 'admin_kantor' | 'case_manager' | 'kepala_bidang' | 'pic_rs' | 'legal_rs'

interface User {
  id: string
  email: string
  full_name: string
  role: Role
  phone: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  wpa_kantor_cabang: { nama: string } | null
  wpa_faskes: { nama: string } | null
}

interface Props {
  users: User[]
  kantorList: { id: string; nama: string; kode: string }[]
  faskesList: { id: string; nama: string; jenis: string }[]
  currentUserId: string
}

const ROLE_LABELS: Record<Role, string> = {
  admin_kantor: 'Admin Kantor',
  case_manager: 'Case Manager',
  kepala_bidang: 'Kepala Bidang',
  pic_rs: 'PIC RS',
  legal_rs: 'Legal RS',
}

const ROLE_COLORS: Record<Role, string> = {
  admin_kantor: 'bg-slate-100 text-slate-800',
  case_manager: 'bg-blue-100 text-blue-800',
  kepala_bidang: 'bg-teal-100 text-teal-800',
  pic_rs: 'bg-orange-100 text-orange-800',
  legal_rs: 'bg-purple-100 text-purple-800',
}

export function UserManagement({ users, kantorList, faskesList, currentUserId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [createdPwd, setCreatedPwd] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'case_manager' as Role,
    phone: '',
    kantor_cabang_id: '',
    faskes_id: '',
  })
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setCreatedPwd(null)
    try {
      const password = generatePassword(12)
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat user')
      setCreatedPwd(password)
      setOpen(false)
      setForm({ email: '', full_name: '', role: 'case_manager', phone: '', kantor_cabang_id: '', faskes_id: '' })
      router.refresh()
      toast.success('User berhasil dibuat')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  
  async function toggleActive(user: User) {
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
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
      const password = generatePassword(12)
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, password }),
      })
      if (!res.ok) throw new Error('Gagal reset')
      setCreatedPwd(password)
      toast.success('Password berhasil direset')
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-700 hover:bg-blue-800">
              <Plus className="w-4 h-4 mr-2" /> Tambah User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Buat User Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Nama Lengkap *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} required />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v: Role) => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>No. Telepon</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              {(form.role === 'admin_kantor' || form.role === 'case_manager' || form.role === 'kepala_bidang') && (
                <div>
                  <Label>Kantor Cabang</Label>
                  <Select value={form.kantor_cabang_id} onValueChange={v => setForm(f => ({ ...f, kantor_cabang_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih kantor cabang" /></SelectTrigger>
                    <SelectContent>
                      {kantorList.map(k => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(form.role === 'pic_rs' || form.role === 'legal_rs') && (
                <div>
                  <Label>Faskes *</Label>
                  <Select value={form.faskes_id} onValueChange={v => setForm(f => ({ ...f, faskes_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih faskes" /></SelectTrigger>
                    <SelectContent>
                      {faskesList.map(f => <SelectItem key={f.id} value={f.id}>{f.nama} ({f.jenis})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Menyimpan...' : 'Buat User'}
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
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Kantor/Faskes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Login Terakhir</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.wpa_kantor_cabang?.nama || u.wpa_faskes?.nama || '-'}
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Aktif</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Belum pernah'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => resetPassword(u)} title="Reset Password">
                        <KeyRound className="w-4 h-4 text-orange-600" />
                      </Button>
                      {u.id !== currentUserId && (
                        <Button size="icon" variant="ghost" onClick={() => toggleActive(u)} title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                          <Power className={`w-4 h-4 ${u.is_active ? 'text-red-600' : 'text-green-600'}`} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Modal tampilkan password hasil create/reset */}
      {createdPwd && (
        <Dialog open={!!createdPwd} onOpenChange={() => setCreatedPwd(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Password Sementara</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Berikut password sementara user. Bagikan kepada user melalui kanal aman (WhatsApp/email pribadi). 
                User akan diminta mengganti password setelah login pertama.
              </p>
              <div className="bg-slate-100 rounded p-3 font-mono text-sm flex items-center justify-between">
                <span>{createdPwd}</span>
                <Button size="sm" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(createdPwd)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
