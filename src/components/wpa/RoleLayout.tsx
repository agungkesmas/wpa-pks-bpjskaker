import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { RoleShell } from '@/components/wpa/RoleShell'
import type { UserRole } from '@/lib/auth-constants'

interface Props {
  children: React.ReactNode
  allowedRole: UserRole
}

export async function RoleLayout({ children, allowedRole }: Props) {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== allowedRole) redirect(`/${user.role}`)
  
  let kantor_nama: string | undefined
  
  if (user.kantor_cabang_id) {
    const { data: kantor } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .select('nama')
      .eq('id', user.kantor_cabang_id)
      .single()
    kantor_nama = kantor?.nama
  } else if (user.faskes_id) {
    const { data: faskes } = await supabaseAdmin
      .from('wpa_faskes')
      .select('nama')
      .eq('id', user.faskes_id)
      .single()
    kantor_nama = faskes?.nama ? `Faskes: ${faskes.nama}` : undefined
  } else if (user.role === 'super_admin') {
    kantor_nama = 'Super Admin (Semua Cabang)'
  }
  
  const { data: notifs } = await supabaseAdmin
    .from('wpa_notifications')
    .select('id, title, body, created_at')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10)
  
  return (
    <RoleShell user={user} kantor_nama={kantor_nama} notifications={notifs || []}>
      {children}
    </RoleShell>
  )
}
