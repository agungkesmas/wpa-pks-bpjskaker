// ============================================================
// WPA CONSTANTS — Single source of truth for pipeline stages,
// labels, and transition flow. Import from here; do NOT duplicate
// TAHAP_LABELS across files.
// ============================================================

// --- Jenis Pipeline (canonical keys) ---
export type JenisPipeline =
  | 'pks_baru'
  | 'perpanjangan'
  | 'adendum_harga'
  | 'adendum_layanan_baru'
  | 'adendum_dropping'
  | 'perubahan_data'

export const JENIS_PENGAJUAN_LABELS: Record<string, string> = {
  pks_baru: 'PKS Baru',
  perpanjangan: 'Perpanjangan PKS',
  adendum_harga: 'Adendum Tarif',
  adendum_layanan_baru: 'Adendum Layanan Baru',
  adendum_dropping: 'Adendum Dropping Pusat',
  perubahan_data: 'Adendum Perubahan Data',
}

export const JENIS_PENGAJUAN_SHORT: Record<string, string> = {
  pks_baru: 'PKS Baru',
  perpanjangan: 'Perpanjangan',
  adendum_harga: 'Adendum Tarif',
  adendum_layanan_baru: 'Adendum Layanan',
  adendum_dropping: 'Dropping Pusat',
  perubahan_data: 'Perubahan Data',
}

// --- Tahap Labels (canonical — label "Kajian Tarif" for tinjauan_tarif) ---
export const TAHAP_LABELS: Record<string, string> = {
  diajukan: 'Pengajuan',
  ditinjau: 'Peninjauan Surat',
  kredensialing: 'Kredensialing',
  kredensialing_ulang: 'Kredensialing Ulang',
  tinjauan_tarif: 'Kajian Tarif',
  drafting_pks: 'Drafting PKS',
  drafting_adendum: 'Drafting Adendum',
  approval_kabid: 'Approval Kabid',
  review_legal_rs: 'Review Legal RS',
  tanda_tangan: 'Tanda Tangan',
  completed: 'Selesai',
}

// --- Tahap Flow per Jenis Pipeline ---
// (current_tahap → next_tahap, default handler_role)
// Note: 'adendum_harga' and 'adendum_layanan_baru' share the same flow shape
// (kredensialing_ulang added to all adendum flows that touch faskes credentials)
export const TAHAP_FLOW: Record<string, { current: string; next: string; handler_role: string }[]> = {
  pks_baru: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'kredensialing', handler_role: 'case_manager' },
    { current: 'kredensialing', next: 'tinjauan_tarif', handler_role: 'case_manager' },
    { current: 'tinjauan_tarif', next: 'drafting_pks', handler_role: 'case_manager' },
    { current: 'drafting_pks', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  perpanjangan: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'kredensialing_ulang', handler_role: 'case_manager' },
    { current: 'kredensialing_ulang', next: 'tinjauan_tarif', handler_role: 'case_manager' },
    { current: 'tinjauan_tarif', next: 'drafting_pks', handler_role: 'case_manager' },
    { current: 'drafting_pks', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  adendum_harga: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'kredensialing_ulang', handler_role: 'case_manager' },
    { current: 'kredensialing_ulang', next: 'tinjauan_tarif', handler_role: 'case_manager' },
    { current: 'tinjauan_tarif', next: 'drafting_adendum', handler_role: 'case_manager' },
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  // adendum_layanan_baru = same shape as adendum_harga (new layanan implies new tarif too)
  adendum_layanan_baru: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'kredensialing_ulang', handler_role: 'case_manager' },
    { current: 'kredensialing_ulang', next: 'tinjauan_tarif', handler_role: 'case_manager' },
    { current: 'tinjauan_tarif', next: 'drafting_adendum', handler_role: 'case_manager' },
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  // Dropping Pusat: 4 tahap (skip diajuan/ditinjau/kredensialing/tinjauan_tarif —
  // karena ini adendum dari pusat, langsung drafting. Initiated_by = CM/Kabid.)
  adendum_dropping: [
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  // Perubahan Data: skip kredensialing_ulang & tinjauan_tarif (bukan tarif, bukan cred)
  perubahan_data: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'drafting_adendum', handler_role: 'case_manager' },
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
}

// Tahap yang bisa di-skip (conditional, is_wajib = false in DB)
export const SKIPPABLE_TAHAPS = ['tinjauan_tarif']

// --- Tahap Config Seed (urutan, is_wajib, sla, handler, desc) ---
// Used by SQL migration; mirrors TAHAP_FLOW. Kept here as reference for the
// SQL file so they don't drift. Label "Kajian Tarif" — never "Negosiasi".
export const TAHAP_CONFIG_SEED: Array<{
  jenis_pipeline: string
  tahap: string
  urutan: number
  is_wajib: boolean
  default_sla_days: number
  handler_role: string
  description: string
}> = [
  // PKS BARU (8 tahap)
  { jenis_pipeline: 'pks_baru', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS submit form pengajuan' },
  { jenis_pipeline: 'pks_baru', tahap: 'ditinjau', urutan: 2, is_wajib: true, default_sla_days: 2, handler_role: 'case_manager', description: 'CM review kelengkapan dokumen' },
  { jenis_pipeline: 'pks_baru', tahap: 'kredensialing', urutan: 3, is_wajib: true, default_sla_days: 7, handler_role: 'case_manager', description: 'Verifikasi dokumen + visitasi' },
  { jenis_pipeline: 'pks_baru', tahap: 'tinjauan_tarif', urutan: 4, is_wajib: true, default_sla_days: 7, handler_role: 'case_manager', description: 'Kajian tarif vs Bank Tarif acuan' },
  { jenis_pipeline: 'pks_baru', tahap: 'drafting_pks', urutan: 5, is_wajib: true, default_sla_days: 7, handler_role: 'case_manager', description: 'Auto-create draft dari template + data' },
  { jenis_pipeline: 'pks_baru', tahap: 'approval_kabid', urutan: 6, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid (4-Eyes)' },
  { jenis_pipeline: 'pks_baru', tahap: 'review_legal_rs', urutan: 7, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review legal RS' },
  { jenis_pipeline: 'pks_baru', tahap: 'tanda_tangan', urutan: 8, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'Tanda tangan elektronik' },

  // PERPANJANGAN (8 tahap — kredensialing_ulang + tinjauan_tarif)
  { jenis_pipeline: 'perpanjangan', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS/CM ajukan perpanjangan' },
  { jenis_pipeline: 'perpanjangan', tahap: 'ditinjau', urutan: 2, is_wajib: true, default_sla_days: 2, handler_role: 'case_manager', description: 'CM review data' },
  { jenis_pipeline: 'perpanjangan', tahap: 'kredensialing_ulang', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Asesmen mandiri/visitasi ulang' },
  { jenis_pipeline: 'perpanjangan', tahap: 'tinjauan_tarif', urutan: 4, is_wajib: false, default_sla_days: 5, handler_role: 'case_manager', description: 'Conditional: skip jika tarif sama & wajar' },
  { jenis_pipeline: 'perpanjangan', tahap: 'drafting_pks', urutan: 5, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Auto-clone dari PKS lama' },
  { jenis_pipeline: 'perpanjangan', tahap: 'approval_kabid', urutan: 6, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'perpanjangan', tahap: 'review_legal_rs', urutan: 7, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review legal RS' },
  { jenis_pipeline: 'perpanjangan', tahap: 'tanda_tangan', urutan: 8, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'Tanda tangan' },

  // ADENDUM HARGA/TARIF (8 tahap — kredensialing_ulang + tinjauan_tarif)
  { jenis_pipeline: 'adendum_harga', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS ajukan perubahan tarif' },
  { jenis_pipeline: 'adendum_harga', tahap: 'ditinjau', urutan: 2, is_wajib: true, default_sla_days: 2, handler_role: 'case_manager', description: 'CM review proposal' },
  { jenis_pipeline: 'adendum_harga', tahap: 'kredensialing_ulang', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Verifikasi ulang kredensial + dokumen pendukung tarif' },
  { jenis_pipeline: 'adendum_harga', tahap: 'tinjauan_tarif', urutan: 4, is_wajib: true, default_sla_days: 7, handler_role: 'case_manager', description: 'Kajian tarif baru vs Bank Tarif acuan' },
  { jenis_pipeline: 'adendum_harga', tahap: 'drafting_adendum', urutan: 5, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Draft adendum dari template' },
  { jenis_pipeline: 'adendum_harga', tahap: 'approval_kabid', urutan: 6, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'adendum_harga', tahap: 'review_legal_rs', urutan: 7, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review legal RS' },
  { jenis_pipeline: 'adendum_harga', tahap: 'tanda_tangan', urutan: 8, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'Tanda tangan' },

  // ADENDUM LAYANAN BARU (8 tahap — same shape as adendum_harga)
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS ajukan layanan baru' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'ditinjau', urutan: 2, is_wajib: true, default_sla_days: 2, handler_role: 'case_manager', description: 'CM review proposal layanan' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'kredensialing_ulang', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Verifikasi kredensial layanan baru' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'tinjauan_tarif', urutan: 4, is_wajib: true, default_sla_days: 7, handler_role: 'case_manager', description: 'Kajian tarif layanan baru' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'drafting_adendum', urutan: 5, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Draft adendum dari template' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'approval_kabid', urutan: 6, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'review_legal_rs', urutan: 7, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review legal RS' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'tanda_tangan', urutan: 8, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'Tanda tangan' },

  // ADENDUM DROPPING PUSAT (4 tahap — skip semua tahap faskes)
  { jenis_pipeline: 'adendum_dropping', tahap: 'drafting_adendum', urutan: 1, is_wajib: true, default_sla_days: 14, handler_role: 'case_manager', description: 'Auto-assign, drafting per target' },
  { jenis_pipeline: 'adendum_dropping', tahap: 'approval_kabid', urutan: 2, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'adendum_dropping', tahap: 'review_legal_rs', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review legal RS' },
  { jenis_pipeline: 'adendum_dropping', tahap: 'tanda_tangan', urutan: 4, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'Tanda tangan' },

  // PERUBAHAN DATA (6 tahap — skip kredensialing_ulang & tinjauan_tarif)
  { jenis_pipeline: 'perubahan_data', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS ajukan perubahan data' },
  { jenis_pipeline: 'perubahan_data', tahap: 'ditinjau', urutan: 2, is_wajib: true, default_sla_days: 2, handler_role: 'case_manager', description: 'CM review' },
  { jenis_pipeline: 'perubahan_data', tahap: 'drafting_adendum', urutan: 3, is_wajib: true, default_sla_days: 3, handler_role: 'case_manager', description: 'Draft adendum perubahan data' },
  { jenis_pipeline: 'perubahan_data', tahap: 'approval_kabid', urutan: 4, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'perubahan_data', tahap: 'review_legal_rs', urutan: 5, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review legal RS' },
  { jenis_pipeline: 'perubahan_data', tahap: 'tanda_tangan', urutan: 6, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'Tanda tangan' },
]

// --- Tahap list per jenis (ordered) — for UI tracking display ---
export function getTahapList(jenis: string): string[] {
  const flow = TAHAP_FLOW[jenis]
  if (!flow) return []
  const list: string[] = []
  // Find start (tahap not appearing as `next` in any step)
  const allNexts = new Set(flow.map(s => s.next))
  let current = flow.find(s => !allNexts.has(s.current))?.current
  while (current && current !== '__complete__') {
    list.push(current)
    const step = flow.find(s => s.current === current)
    current = step?.next
  }
  return list
}
