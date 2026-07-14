import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { RoleShell } from '@/components/wpa/RoleShell'

export default async function CaseManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'case_manager') redirect(`/${user.role}`)
  
  const { data: kantor } = await supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('nama')
    .eq('id', user.kantor_cabang_id || '')
    .single()
  
  const { data: notifs } = await supabaseAdmin
    .from('wpa_notifications')
    .select('id, title, body, created_at')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10)
  
  return (
    <RoleShell user={user} kantor_nama={kantor?.nama} notifications={notifs || []}>
      {children}
    </RoleShell>
  )
}
