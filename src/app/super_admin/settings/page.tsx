import { getSession } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Placeholder } from '@/components/wpa/Placeholder'

export default async function SettingsPage() {
  const me = await getSession()
  if (!me) return null
  return <Placeholder title="Pengaturan Sistem" description="Konfigurasi global: toggle self-register, default values, integrasi." />
}
