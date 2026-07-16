'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Building2, MapPin, Phone, UserCircle, KeyRound, Printer, ChevronRight, Loader2, Eye, EyeOff, Copy } from 'lucide-react'
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

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id)
  }

  function togglePasswordVisibility(userId: string) {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }))
  }

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
        body: JSON.stringify({
          user_id: resetDialog.userId,
          temp_password: newPassword,
          must_change_password: true,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Password ${resetDialog.faskesNama} berhasil di-reset`)
      setResetDialog(null)
      setNewPassword('')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handlePrintCredential(userId: string) {
    setPrintLoading(userId)
    setTimeout(() => {
      window.open(`/api/print/slip-kredensial?user_id=${userId}`, '_blank')
      setPrintLoading(null)
    }, 100)
  }

  function handlePrintAll() {
    faskesList.forEach((f, i) => {
      const picUser = (f.wpa_user_faskes || []).find(uf => uf.is_primary)?.wpa_users
      if (picUser) {
        setTimeout(() => {
          window.open(`/api/print/slip-kredensial?user_id=${picUser.id}`, '_blank')
        }, i * 500)
      }
    })
    toast.success(`Mencetak kredensial untuk ${faskesList.length} faskes`)
  }

  function copyCredential(email: string, password: string) {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}\nLogin: https://mitra-plkk.vercel.app`)
    toast.success('Kredensial disalin')
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="text-sm font-semibold">Daftar Faskes + PIC RS</div>
          <Button size="sm" variant="outline" onClick={handlePrintAll}>
            <Printer className="w-3 h-3 mr-1" /> Print Semua Kredensial
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Nama Faskes</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>PIC RS</TableHead>
              <TableHead>Email PIC</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {faskesList.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">Belum ada faskes</TableCell></TableRow>
            ) : faskesList.map(f => {
              const picUser = (f.wpa_user_faskes || []).find(uf => uf.is_primary)?.wpa_users
              const isExpanded = expandedId === f.id
              return (
                <>
                  <TableRow key={f.id} className="cursor-pointer hover:bg-slate-50" onClick={() => toggleExpand(f.id)}>
                    <TableCell className="text-center">
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-700 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{f.nama}</div>
                          {f.alamat && <div className="text-xs text-slate-500 truncate max-w-[200px]">{f.alamat}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{f.jenis}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {picUser ? (
                        <div>
                          <div className="font-medium">{picUser.full_name}</div>
                          {picUser.phone && <div className="text-slate-400">{picUser.phone}</div>}
                        </div>
                      ) : <span className="text-slate-400">Belum ada</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {picUser ? picUser.email : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {picUser?.temp_password ? (
                        <div className="flex items-center gap-1">
                          <code className="bg-slate-100 px-1 rounded font-mono">
                            {showPasswords[picUser.id] ? picUser.temp_password : '••••••••'}
                          </code>
                          <button onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(picUser.id) }} className="text-slate-400 hover:text-slate-600">
                            {showPasswords[picUser.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={f.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>{f.status}</Badge>
                        {picUser?.must_change_password && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Must Change</Badge>}
                        {picUser?.last_login_at && <Badge className="bg-blue-100 text-blue-800 text-[10px]">Sudah Login</Badge>}
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
                      <TableCell colSpan={8} className="p-4">
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
    </Card>
  )
}
