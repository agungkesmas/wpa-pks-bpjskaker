import { getSession } from '@/lib/auth'
import { PipelineDetailView } from '@/components/wpa/PipelineDetailView'

export default async function PPDetailPage() {
  const me = await getSession()
  if (!me) return null
  return <PipelineDetailView role="penata_pelayanan" currentUserId={me.id} />
}
