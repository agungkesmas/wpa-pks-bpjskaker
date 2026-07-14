import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { RoleShell } from '@/components/wpa/RoleShell'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'super_admin') redirect(`/${user.role}`)
  
  const { data: notifs } = await supabaseAdmin
    .from('wpa_notifications')
    .select('id, title, body, created_at')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10)
  
  return (
    <RoleShell user={user} kantor_nama="Super Admin (Semua Cabang)" notifications={notifs || []}>
      {children}
    </RoleShell>
  )
}
