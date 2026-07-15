import { getSession } from '@/lib/auth'
import { PipelineDetailView } from '@/components/wpa/PipelineDetailView'

export default async function KabidDetailPage() {
  const me = await getSession()
  if (!me) return null
  return <PipelineDetailView role="kepala_bidang" currentUserId={me.id} />
}
