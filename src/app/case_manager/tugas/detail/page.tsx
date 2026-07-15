import { getSession } from '@/lib/auth'
import { PipelineDetailView } from '@/components/wpa/PipelineDetailView'

export default async function CMDetailPage() {
  const me = await getSession()
  if (!me) return null
  return <PipelineDetailView role="case_manager" currentUserId={me.id} />
}
