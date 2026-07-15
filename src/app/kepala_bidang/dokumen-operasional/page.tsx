import { getSession } from '@/lib/auth'
import { DokumenOperasionalView } from '@/components/wpa/DokumenOperasionalView'
export default async function Page() {
  const me = await getSession()
  if (!me) return null
  return <DokumenOperasionalView role="kepala_bidang" />
}
