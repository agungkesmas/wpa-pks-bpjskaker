import { RoleLayout } from '@/components/wpa/RoleLayout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <RoleLayout allowedRole="case_manager">{children}</RoleLayout>
}
