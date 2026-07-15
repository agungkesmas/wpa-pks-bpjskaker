import { redirect } from 'next/navigation'
import KantorListPage from '@/app/super_admin/kantor/page'
import { getSession } from '@/lib/auth'

export default async function AdminKantorPage() {
  const me = await getSession()
  if (!me) return null
  // Reuse the same component
  return <KantorListPage />
}
