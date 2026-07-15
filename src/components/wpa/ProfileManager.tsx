'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, KeyRound, Camera, Mail, Phone, Save, AlertCircle, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { ROLE_LABELS, type UserRole } from '@/lib/auth-constants'

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-rose-100 text-rose-800',
  case_manager: 'bg-blue-100 text-blue-800',
  kepala_bidang: 'bg-teal-100 text-teal-800',
  penata_pelayanan: 'bg-cyan-100 text-cyan-800',
  pic_rs: 'bg-orange-100 text-orange-800',
  legal_rs: 'bg-purple-100 text-purple-800',
}

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
  wpa_kantor_cabang: { nama: string; kode: string } | null
  wpa_user_faskes: any[] | null
}

export function ProfileManager({ user }: { user: User }) {
  const router = useRouter()
  const initials = user.full_name.split(' ').map(w => w.charAt(0)).slice(0,2).join('').toUpperCase()
  
  // Phone form
  const [phone, setPhone] = useState(user.phone || '')
  const [savingPhone, setSavingPhone] = useState(false)
  
  // Password form
  const [pwdForm, setPwdForm] = useState({ password_lama: '', password_baru: '', konfirmasi: '' })
  const [savingPwd, setSavingPwd] = useState(false)
  
  // Email form
  const [emailForm, setEmailForm] = useState({ email_lama: user.email, email_baru: '', password_lama: '' })
  const [savingEmail, setSavingEmail] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  
  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  
  async function savePhone() {
    setSavingPhone(true)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('No. HP diperbarui')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingPhone(false)
    }
  }
  
  async function changePassword() {
    if (pwdForm.password_baru !== pwdForm.konfirmasi) {
      toast.error('Konfirmasi password tidak sesuai')
      return
    }
    if (pwdForm.password_baru.length < 8) {
      toast.error('Password baru minimal 8 karakter')
      return
    }
    if (!/[A-Z]/.test(pwdForm.password_baru) || !/[a-z]/.test(pwdForm.password_baru) || !/[0-9]/.test(pwdForm.password_baru)) {
      toast.error('Password harus mengandung huruf besar, huruf kecil, dan angka')
      return
    }
    setSavingPwd(true)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_lama: pwdForm.password_lama, password_baru: pwdForm.password_baru })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Password berhasil diubah')
      setPwdForm({ password_lama: '', password_baru: '', konfirmasi: '' })
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingPwd(false)
    }
  }
  
  async function changeEmail() {
    setSavingEmail(true)
    try {
      const res = await fetch('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message || 'Email berhasil diubah. Anda akan logout otomatis.')
      setShowEmailForm(false)
      // Auto logout setelah 2 detik
      setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
      }, 2000)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingEmail(false)
    }
  }
  
  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/profile/photo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Foto profil diperbarui')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploadingPhoto(false)
    }
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Profile card */}
      <Card className="lg:col-span-1">
        <CardContent className="p-6 text-center">
          <div className="relative inline-block">
            <Avatar className="w-32 h-32 mx-auto mb-3">
              {user.profile_photo_url ? (
                <img src={user.profile_photo_url} alt={user.full_name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <AvatarFallback className={`text-4xl ${ROLE_COLORS[user.role]}`}>{initials}</AvatarFallback>
              )}
            </Avatar>
            <label className="absolute bottom-3 right-3 bg-white border border-slate-300 rounded-full p-2 cursor-pointer hover:bg-slate-50 shadow-sm">
              {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
              <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploadingPhoto} />
            </label>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{user.full_name}</h2>
          <Badge className={`${ROLE_COLORS[user.role]} mt-1`}>{ROLE_LABELS[user.role]}</Badge>
          
          <Separator className="my-4" />
          
          <div className="text-left space-y-2 text-sm">
            <div>
              <span className="text-xs text-slate-500">Email</span>
              <div className="font-medium break-all">{user.email}</div>
            </div>
            <div>
              <span className="text-xs text-slate-500">NIP</span>
              <div className="font-medium font-mono">{user.nip || '-'}</div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Kantor</span>
              <div className="font-medium">{user.wpa_kantor_cabang?.nama || '-'}</div>
            </div>
            {user.wpa_user_faskes && user.wpa_user_faskes.length > 0 && (
              <div>
                <span className="text-xs text-slate-500">Faskes ({user.wpa_user_faskes.length})</span>
                {user.wpa_user_faskes.map((uf, i) => (
                  <div key={i} className="font-medium text-xs">
                    {uf.is_primary && '★ '}{uf.wpa_faskes?.nama} ({uf.wpa_faskes?.jenis})
                  </div>
                ))}
              </div>
            )}
            <div>
              <span className="text-xs text-slate-500">Login Terakhir</span>
              <div className="font-medium text-xs">
                {user.last_login_at ? new Date(user.last_login_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Belum pernah'}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Bergabung Sejak</span>
              <div className="font-medium text-xs">
                {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Right: Edit forms */}
      <div className="lg:col-span-2 space-y-6">
        {/* Must change password warning */}
        {user.must_change_password && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-700" />
              <div>
                <p className="text-sm font-semibold text-yellow-900">Anda harus mengganti password</p>
                <p className="text-xs text-yellow-800">Password Anda masih password sementara dari admin. Silakan ubah di bawah.</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Phone */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="w-4 h-4 text-slate-600" /> No. Telepon</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08123456789" />
            <Button onClick={savePhone} disabled={savingPhone || phone === (user.phone || '')}>
              {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          </CardContent>
        </Card>
        
        {/* Password */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4 text-slate-600" /> Ubah Password</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Password Lama</Label>
              <Input type="password" value={pwdForm.password_lama} onChange={e => setPwdForm(f => ({ ...f, password_lama: e.target.value }))} />
            </div>
            <div>
              <Label>Password Baru</Label>
              <Input type="password" value={pwdForm.password_baru} onChange={e => setPwdForm(f => ({ ...f, password_baru: e.target.value }))} />
              <p className="text-xs text-slate-500 mt-1">Min 8 karakter, huruf besar, huruf kecil, angka</p>
            </div>
            <div>
              <Label>Konfirmasi Password Baru</Label>
              <Input type="password" value={pwdForm.konfirmasi} onChange={e => setPwdForm(f => ({ ...f, konfirmasi: e.target.value }))} />
            </div>
            <Button onClick={changePassword} disabled={savingPwd || !pwdForm.password_lama || !pwdForm.password_baru}>
              {savingPwd ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Ubah Password
            </Button>
          </CardContent>
        </Card>
        
        {/* Email */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4 text-slate-600" /> Ubah Email</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-slate-50 p-3 rounded text-sm">
              Email saat ini: <strong>{user.email}</strong>
            </div>
            {!showEmailForm ? (
              <Button variant="outline" onClick={() => setShowEmailForm(true)}>Ubah Email</Button>
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-800">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Mengubah email akan logout otomatis. Anda harus login kembali dengan email baru.
                </div>
                <div>
                  <Label>Email Lama (konfirmasi)</Label>
                  <Input type="email" value={emailForm.email_lama} onChange={e => setEmailForm(f => ({ ...f, email_lama: e.target.value }))} />
                </div>
                <div>
                  <Label>Email Baru</Label>
                  <Input type="email" value={emailForm.email_baru} onChange={e => setEmailForm(f => ({ ...f, email_baru: e.target.value }))} />
                </div>
                <div>
                  <Label>Password (verifikasi)</Label>
                  <Input type="password" value={emailForm.password_lama} onChange={e => setEmailForm(f => ({ ...f, password_lama: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={changeEmail} disabled={savingEmail || !emailForm.email_baru || !emailForm.password_lama}>
                    {savingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                    Ubah Email
                  </Button>
                  <Button variant="outline" onClick={() => setShowEmailForm(false)}>Batal</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Field yang admin-only */}
        <Card className="border-dashed">
          <CardHeader><CardTitle className="text-base text-slate-500">Field yang Hanya Bisa Diubah Admin</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-1">
            <p>• Nama Lengkap — hubungi admin untuk koreksi</p>
            <p>• Role / Jabatan — diubah admin via SK</p>
            <p>• Kantor Cabang — diubah admin via fitur Mutasi</p>
            <p>• NIP — diubah admin</p>
            <p>• Status Aktif/Nonaktif — admin kontrol</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
