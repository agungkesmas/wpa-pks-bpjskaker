import { getSession } from '@/lib/auth'
import { TugasSayaView } from '@/components/wpa/TugasSayaView'

export default async function PPTugasPage() {
  const me = await getSession()
  if (!me) return null
  return <TugasSayaView role="penata_pelayanan" currentUserId={me.id} />
}
