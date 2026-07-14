import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function AdminUsersPage() {
  const me = await getSession()
  if (!me) return redirect('/login')
  
  // admin_kantor redirect ke detail kantornya (tab Users)
  if (me.role === 'admin_kantor' && me.kantor_cabang_id) {
    redirect(`/admin_kantor/kantor/${me.kantor_cabang_id}`)
  }
  // super_admin redirect ke /super_admin/users (flat list)
  if (me.role === 'super_admin') {
    redirect('/super_admin/users')
  }
  redirect('/')
}
