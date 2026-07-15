import { getSession } from '@/lib/auth'
import { TugasSayaView } from '@/components/wpa/TugasSayaView'

export default async function KabidTugasPage() {
  const me = await getSession()
  if (!me) return null
  return <TugasSayaView role="kepala_bidang" currentUserId={me.id} />
}
