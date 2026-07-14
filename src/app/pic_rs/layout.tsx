import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { RoleShell } from '@/components/wpa/RoleShell'

export default async function PicRsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'pic_rs') redirect(`/${user.role}`)
  
  const { data: notifs } = await supabaseAdmin
    .from('wpa_notifications')
    .select('id, title, body, created_at')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10)
  
  let faskes_nama: string | undefined
  if (user.faskes_id) {
    const { data: faskes } = await supabaseAdmin
      .from('wpa_faskes')
      .select('nama')
      .eq('id', user.faskes_id)
      .single()
    faskes_nama = faskes?.nama
  }
  
  return (
    <RoleShell user={user} kantor_nama={faskes_nama ? `RS: ${faskes_nama}` : undefined} notifications={notifs || []}>
      {children}
    </RoleShell>
  )
}
