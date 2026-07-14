// Constants & types — Manajemen PLKK (6 role final)
// JANGAN import next/headers di file ini.

export type UserRole = 'super_admin' | 'kepala_bidang' | 'case_manager' | 'penata_pelayanan' | 'pic_rs' | 'legal_rs'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  kantor_cabang_id: string | null
  faskes_id: string | null
  phone: string | null
  nip: string | null
  profile_photo_url: string | null
  must_change_password: boolean
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  kepala_bidang: 'Kepala Bidang Pelayanan',
  case_manager: 'Case Manager',
  penata_pelayanan: 'Penata Pelayanan',
  pic_rs: 'PIC RS',
  legal_rs: 'Legal RS',
}

export const ROLE_THEMES: Record<UserRole, { primary: string; bg: string; sidebar: string }> = {
  super_admin: { primary: 'bg-rose-700', bg: 'bg-rose-50', sidebar: 'bg-rose-900' },
  kepala_bidang: { primary: 'bg-teal-700', bg: 'bg-teal-50', sidebar: 'bg-teal-900' },
  case_manager: { primary: 'bg-blue-700', bg: 'bg-blue-50', sidebar: 'bg-blue-900' },
  penata_pelayanan: { primary: 'bg-cyan-600', bg: 'bg-cyan-50', sidebar: 'bg-cyan-800' },
  pic_rs: { primary: 'bg-orange-600', bg: 'bg-orange-50', sidebar: 'bg-orange-800' },
  legal_rs: { primary: 'bg-purple-800', bg: 'bg-purple-50', sidebar: 'bg-purple-900' },
}

// Role yang punya akses admin (kelola user/template)
export const ADMIN_ROLES: UserRole[] = ['super_admin', 'kepala_bidang']

// Roles BPJS internal (di cabang)
export const BPJS_CABANG_ROLES: UserRole[] = ['kepala_bidang', 'case_manager', 'penata_pelayanan']

// Roles RS/eksternal
export const RS_ROLES: UserRole[] = ['pic_rs', 'legal_rs']

// Roles yang boleh handle drafting (anti-tumbang fallback)
export const DRAFTER_ROLES: UserRole[] = ['case_manager', 'penata_pelayanan', 'kepala_bidang']

export function isAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role)
}

export function isBPJSCabang(role: UserRole): boolean {
  return BPJS_CABANG_ROLES.includes(role)
}

export function isRS(role: UserRole): boolean {
  return RS_ROLES.includes(role)
}
