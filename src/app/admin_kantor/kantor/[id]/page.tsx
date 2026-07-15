import { redirect } from 'next/navigation'
import KantorDetailPage from '@/app/super_admin/kantor/[id]/page'
import { getSession } from '@/lib/auth'

export default async function AdminKantorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSession()
  if (!me) return redirect('/login')
  return <KantorDetailPage params={params} />
}
