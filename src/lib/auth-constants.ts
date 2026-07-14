// Constants & types yang aman untuk di-share antara server & client components.
// JANGAN import next/headers di file ini.

export type UserRole = 'admin_kantor' | 'case_manager' | 'kepala_bidang' | 'pic_rs' | 'legal_rs'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  kantor_cabang_id: string | null
  faskes_id: string | null
  phone: string | null
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin_kantor: 'Admin Kantor',
  case_manager: 'Case Manager BPJS',
  kepala_bidang: 'Kepala Bidang Pelayanan BPJS',
  pic_rs: 'PIC RS',
  legal_rs: 'Legal / Pimpinan RS',
}

export const ROLE_THEMES: Record<UserRole, { primary: string; bg: string; sidebar: string }> = {
  admin_kantor: { primary: 'bg-slate-700', bg: 'bg-slate-50', sidebar: 'bg-slate-800' },
  case_manager: { primary: 'bg-blue-700', bg: 'bg-blue-50', sidebar: 'bg-blue-900' },
  kepala_bidang: { primary: 'bg-teal-700', bg: 'bg-teal-50', sidebar: 'bg-teal-900' },
  pic_rs: { primary: 'bg-orange-600', bg: 'bg-orange-50', sidebar: 'bg-orange-800' },
  legal_rs: { primary: 'bg-purple-800', bg: 'bg-purple-50', sidebar: 'bg-purple-900' },
}
