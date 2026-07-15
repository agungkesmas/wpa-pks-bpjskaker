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

  // Parallel: fetch kantor/faskes nama + notifications sekaligus
  // (sebelumnya sequential — bisa hemat 200-400ms per page load)
  let kantor_nama: string | undefined
  const [kantoData, notifsData] = await Promise.all([
    // Lookup kantor/faskes nama
    (async () => {
      if (user.kantor_cabang_id) {
        const { data: kantor } = await supabaseAdmin
          .from('wpa_kantor_cabang')
          .select('nama')
          .eq('id', user.kantor_cabang_id)
          .single()
        return kantor?.nama
      } else if (user.faskes_id) {
        const { data: faskes } = await supabaseAdmin
          .from('wpa_faskes')
          .select('nama')
          .eq('id', user.faskes_id)
          .single()
        return faskes?.nama ? `Faskes: ${faskes.nama}` : undefined
      } else if (user.role === 'super_admin') {
        return 'Super Admin (Semua Cabang)'
      }
      return undefined
    })(),
    // Fetch notifications
    supabaseAdmin
      .from('wpa_notifications')
      .select('id, title, body, created_at')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  kantor_nama = kantoData
  const notifs = notifsData?.data || []

  return (
    <RoleShell user={user} kantor_nama={kantor_nama} notifications={notifs}>
      {children}
    </RoleShell>
  )
}
