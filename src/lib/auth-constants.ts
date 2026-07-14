// Constants & types yang aman untuk di-share antara server & client components.
// JANGAN import next/headers di file ini.

export type UserRole = 'super_admin' | 'admin_kantor' | 'case_manager' | 'kepala_bidang' | 'pic_rs' | 'legal_rs'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  kantor_cabang_id: string | null
  faskes_id: string | null  // primary faskes (untuk PIC RS multi-faskes)
  phone: string | null
  nip: string | null
  profile_photo_url: string | null
  must_change_password: boolean
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrator',
  admin_kantor: 'Admin Kantor',
  case_manager: 'Case Manager BPJS',
  kepala_bidang: 'Kepala Bidang Pelayanan BPJS',
  pic_rs: 'PIC RS',
  legal_rs: 'Legal / Pimpinan RS',
}

export const ROLE_THEMES: Record<UserRole, { primary: string; bg: string; sidebar: string }> = {
  super_admin: { primary: 'bg-rose-700', bg: 'bg-rose-50', sidebar: 'bg-rose-900' },
  admin_kantor: { primary: 'bg-slate-700', bg: 'bg-slate-50', sidebar: 'bg-slate-800' },
  case_manager: { primary: 'bg-blue-700', bg: 'bg-blue-50', sidebar: 'bg-blue-900' },
  kepala_bidang: { primary: 'bg-teal-700', bg: 'bg-teal-50', sidebar: 'bg-teal-900' },
  pic_rs: { primary: 'bg-orange-600', bg: 'bg-orange-50', sidebar: 'bg-orange-800' },
  legal_rs: { primary: 'bg-purple-800', bg: 'bg-purple-50', sidebar: 'bg-purple-900' },
}

// Roles yang punya akses admin (CRUD user, kantor, dll)
export const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin_kantor']

// Roles BPJS internal (bukan RS)
export const BPJS_ROLES: UserRole[] = ['super_admin', 'admin_kantor', 'case_manager', 'kepala_bidang']

// Roles RS/eksternal
export const RS_ROLES: UserRole[] = ['pic_rs', 'legal_rs']

// Cek apakah role adalah admin (punya akses manajemen)
export function isAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role)
}

// Cek apakah role adalah BPJS internal
export function isBPJS(role: UserRole): boolean {
  return BPJS_ROLES.includes(role)
}

