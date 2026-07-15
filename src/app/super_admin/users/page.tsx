import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ROLE_LABELS } from '@/lib/auth-constants'

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-rose-100 text-rose-800',
  kepala_bidang: 'bg-teal-100 text-teal-800',
  case_manager: 'bg-blue-100 text-blue-800',
  penata_pelayanan: 'bg-cyan-100 text-cyan-800',
  pic_rs: 'bg-orange-100 text-orange-800',
  legal_rs: 'bg-purple-100 text-purple-800',
}

export default async function AllUsersPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: users } = await supabaseAdmin
    .from('wpa_users')
    .select(`
      id, email, full_name, role, phone, nip, profile_photo_url, is_active, last_login_at, created_at,
      wpa_kantor_cabang(nama, kode)
    `)
    .order('created_at', { ascending: false })
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Semua User</h1>
        <p className="text-sm text-slate-600">Daftar lengkap user di semua kantor cabang.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Kantor</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Login Terakhir</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users || []).map(u => {
                const initials = u.full_name.split(' ').map(w => w.charAt(0)).slice(0,2).join('').toUpperCase()
                return (
                  <TableRow key={u.id}>
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
                    <TableCell><Badge className={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}</Badge></TableCell>
                    <TableCell className="text-xs">{(u.wpa_kantor_cabang as any)?.nama || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{u.nip || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Belum pernah'}
                    </TableCell>
                    <TableCell>
                      {u.is_active ? <Badge className="bg-green-100 text-green-800">Aktif</Badge> : <Badge className="bg-red-100 text-red-800">Nonaktif</Badge>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
