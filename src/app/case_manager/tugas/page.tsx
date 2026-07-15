import { getSession } from '@/lib/auth'
import { TugasSayaView } from '@/components/wpa/TugasSayaView'

export default async function CMTugasPage() {
  const me = await getSession()
  if (!me) return null
  return <TugasSayaView role="case_manager" currentUserId={me.id} />
}
