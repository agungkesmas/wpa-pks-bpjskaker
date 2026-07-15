import { Suspense } from 'react'
import { getSession } from '@/lib/auth'
import { PipelineDetailView } from '@/components/wpa/PipelineDetailView'
import { Loader2 } from 'lucide-react'

export default async function PPDetailPage() {
  const me = await getSession()
  if (!me) return null
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
      <PipelineDetailView role="penata_pelayanan" currentUserId={me.id} />
    </Suspense>
  )
}
