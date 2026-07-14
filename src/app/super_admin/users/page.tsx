import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ChevronRight, Search } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/auth-constants'

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-rose-100 text-rose-800',
  admin_kantor: 'bg-slate-100 text-slate-800',
  case_manager: 'bg-blue-100 text-blue-800',
  kepala_bidang: 'bg-teal-100 text-teal-800',
  pic_rs: 'bg-orange-100 text-orange-800',
  legal_rs: 'bg-purple-100 text-purple-800',
}

export default async function AllUsersPage() {
  const me = await getSession()
  if (!me) return null
  
  // Get all users (super_admin only) atau all users in own kantor (admin_kantor)
  let query = supabaseAdmin
    .from('wpa_users')
    .select(`
      id, email, full_name, role, phone, nip, profile_photo_url, is_active, last_login_at, created_at,
      wpa_kantor_cabang(nama, kode),
      wpa_user_faskes(wpa_faskes(nama))
    `)
    .order('created_at', { ascending: false })
  
  if (me.role === 'admin_kantor' && me.kantor_cabang_id) {
    query = query.eq('kantor_cabang_id', me.kantor_cabang_id)
  }
  
  const { data: users } = await query
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Semua User</h1>
        <p className="text-sm text-slate-600">
          Daftar lengkap semua user {me.role === 'admin_kantor' ? 'di kantor Anda' : '(semua kantor)'}. 
          Klik nama user untuk detail (segera hadir). Untuk kelola user penuh, buka via <Link href="/super_admin/kantor" className="text-rose-700 underline">Kantor Cabang</Link>.
        </p>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Kantor/Faskes</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Login Terakhir</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
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
                    <TableCell className="text-xs">
                      {u.wpa_kantor_cabang?.nama || '-'}
                      {u.wpa_user_faskes && u.wpa_user_faskes.length > 0 && (
                        <div className="text-slate-500">{u.wpa_user_faskes.map((uf: any) => uf.wpa_faskes?.nama).join(', ')}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{u.nip || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Belum pernah'}
                    </TableCell>
                    <TableCell>
                      {u.is_active ? <Badge className="bg-green-100 text-green-800">Aktif</Badge> : <Badge className="bg-red-100 text-red-800">Nonaktif</Badge>}
                    </TableCell>
                    <TableCell>
                      {u.wpa_kantor_cabang?.kode && (
                        <Link href={`/super_admin/kantor/${u.id}`} className="text-xs text-rose-700 hover:underline">
                          Detail <ChevronRight className="w-3 h-3 inline" />
                        </Link>
                      )}
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
