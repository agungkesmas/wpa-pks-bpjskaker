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
  | 'adendum_masal'
  | 'perubahan_data'

export const JENIS_PENGAJUAN_LABELS: Record<string, string> = {
  pks_baru: 'PKS Baru',
  perpanjangan: 'Perpanjangan PKS',
  adendum_harga: 'Adendum Tarif',
  adendum_layanan_baru: 'Adendum Layanan Baru',
  adendum_dropping: 'Adendum Dropping Pusat',
  adendum_masal: 'Adendum Masal',
  perubahan_data: 'Adendum Perubahan Data',
}

export const JENIS_PENGAJUAN_SHORT: Record<string, string> = {
  pks_baru: 'PKS Baru',
  perpanjangan: 'Perpanjangan',
  adendum_harga: 'Adendum Tarif',
  adendum_layanan_baru: 'Adendum Layanan',
  adendum_dropping: 'Dropping Pusat',
  adendum_masal: 'Adendum Masal',
  perubahan_data: 'Perubahan Data',
}

// --- Tahap Labels (canonical — 6 tahap ringkas) ---
export const TAHAP_LABELS: Record<string, string> = {
  diajukan: 'Pengajuan',
  ditinjau: 'Peninjauan Surat',
  ditinjau_kajian_tarif: 'Peninjauan & Kajian Tarif',
  kredensialing: 'Kredensialing',
  kredensialing_ulang: 'Kredensialing',  // alias (lama)
  tinjauan_tarif: 'Kajian Tarif',  // alias (lama)
  negosiasi_tarif: 'Kajian Tarif',  // alias (lama)
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
// --- Tahap Flow per Jenis Pipeline (6 tahap ringkas) ---
// Alur: Pengajuan → Peninjauan & Kajian Tarif → Kredensialing → Drafting → Approval & Review → Tanda Tangan
export const TAHAP_FLOW: Record<string, { current: string; next: string; handler_role: string }[]> = {
  // PKS BARU (6 tahap)
  pks_baru: [
    { current: 'diajukan', next: 'ditinjau_kajian_tarif', handler_role: 'case_manager' },
    { current: 'ditinjau_kajian_tarif', next: 'kredensialing', handler_role: 'case_manager' },
    { current: 'kredensialing', next: 'drafting_pks', handler_role: 'case_manager' },
    { current: 'drafting_pks', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  // PERPANJANGAN (6 tahap — same as pks_baru)
  perpanjangan: [
    { current: 'diajukan', next: 'ditinjau_kajian_tarif', handler_role: 'case_manager' },
    { current: 'ditinjau_kajian_tarif', next: 'kredensialing', handler_role: 'case_manager' },
    { current: 'kredensialing', next: 'drafting_pks', handler_role: 'case_manager' },
    { current: 'drafting_pks', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  // ADENDUM HARGA/TARIF (6 tahap)
  adendum_harga: [
    { current: 'diajukan', next: 'ditinjau_kajian_tarif', handler_role: 'case_manager' },
    { current: 'ditinjau_kajian_tarif', next: 'kredensialing', handler_role: 'case_manager' },
    { current: 'kredensialing', next: 'drafting_adendum', handler_role: 'case_manager' },
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  // ADENDUM LAYANAN BARU (6 tahap — same as adendum_harga)
  adendum_layanan_baru: [
    { current: 'diajukan', next: 'ditinjau_kajian_tarif', handler_role: 'case_manager' },
    { current: 'ditinjau_kajian_tarif', next: 'kredensialing', handler_role: 'case_manager' },
    { current: 'kredensialing', next: 'drafting_adendum', handler_role: 'case_manager' },
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  // ADENDUM DROPPING PUSAT (4 tahap — skip diajukan/ditinjau/kredensialing)
  adendum_dropping: [
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  // ADENDUM MASAL (3 tahap — PIC RS submit → CM group review → complete)
  adendum_masal: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: '__complete__', handler_role: 'case_manager' },
  ],
  // PERUBAHAN DATA (5 tahap — skip kredensialing, bukan tarif/bukan cred)
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
export const SKIPPABLE_TAHAPS: string[] = []

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
  // PKS BARU (6 tahap)
  { jenis_pipeline: 'pks_baru', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS upload surat + file wajib' },
  { jenis_pipeline: 'pks_baru', tahap: 'ditinjau_kajian_tarif', urutan: 2, is_wajib: true, default_sla_days: 3, handler_role: 'case_manager', description: 'CM review surat + AI kajian tarif vs Bank Tarif' },
  { jenis_pipeline: 'pks_baru', tahap: 'kredensialing', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Asesmen mandiri (default) atau visitasi (jika red flag)' },
  { jenis_pipeline: 'pks_baru', tahap: 'drafting_pks', urutan: 4, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'PIC RS isi placeholder + rapihkan format' },
  { jenis_pipeline: 'pks_baru', tahap: 'approval_kabid', urutan: 5, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid (4-Eyes)' },
  { jenis_pipeline: 'pks_baru', tahap: 'review_legal_rs', urutan: 6, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review Legal RS' },
  { jenis_pipeline: 'pks_baru', tahap: 'tanda_tangan', urutan: 7, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'TTD basah kedua belah pihak' },

  // PERPANJANGAN (6 tahap)
  { jenis_pipeline: 'perpanjangan', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS upload surat permohonan + tarif' },
  { jenis_pipeline: 'perpanjangan', tahap: 'ditinjau_kajian_tarif', urutan: 2, is_wajib: true, default_sla_days: 3, handler_role: 'case_manager', description: 'CM review surat + AI kajian tarif' },
  { jenis_pipeline: 'perpanjangan', tahap: 'kredensialing', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Asesmen mandiri/visitasi' },
  { jenis_pipeline: 'perpanjangan', tahap: 'drafting_pks', urutan: 4, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'PIC RS isi placeholder (auto-clone dari PKS lama)' },
  { jenis_pipeline: 'perpanjangan', tahap: 'approval_kabid', urutan: 5, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'perpanjangan', tahap: 'review_legal_rs', urutan: 6, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review Legal RS' },
  { jenis_pipeline: 'perpanjangan', tahap: 'tanda_tangan', urutan: 7, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'TTD basah + PKS lama berakhir' },

  // ADENDUM HARGA (6 tahap)
  { jenis_pipeline: 'adendum_harga', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS ajukan perubahan tarif' },
  { jenis_pipeline: 'adendum_harga', tahap: 'ditinjau_kajian_tarif', urutan: 2, is_wajib: true, default_sla_days: 3, handler_role: 'case_manager', description: 'CM review + AI kajian tarif baru' },
  { jenis_pipeline: 'adendum_harga', tahap: 'kredensialing', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Verifikasi kredensial + dokumen pendukung tarif' },
  { jenis_pipeline: 'adendum_harga', tahap: 'drafting_adendum', urutan: 4, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'PIC RS isi placeholder adendum' },
  { jenis_pipeline: 'adendum_harga', tahap: 'approval_kabid', urutan: 5, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'adendum_harga', tahap: 'review_legal_rs', urutan: 6, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review Legal RS' },
  { jenis_pipeline: 'adendum_harga', tahap: 'tanda_tangan', urutan: 7, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'TTD basah' },

  // ADENDUM LAYANAN BARU (6 tahap — same as adendum_harga)
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS ajukan layanan baru' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'ditinjau_kajian_tarif', urutan: 2, is_wajib: true, default_sla_days: 3, handler_role: 'case_manager', description: 'CM review + AI kajian tarif layanan baru' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'kredensialing', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'Verifikasi kredensial layanan baru' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'drafting_adendum', urutan: 4, is_wajib: true, default_sla_days: 5, handler_role: 'case_manager', description: 'PIC RS isi placeholder adendum' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'approval_kabid', urutan: 5, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'review_legal_rs', urutan: 6, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review Legal RS' },
  { jenis_pipeline: 'adendum_layanan_baru', tahap: 'tanda_tangan', urutan: 7, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'TTD basah' },

  // ADENDUM DROPPING PUSAT (4 tahap)
  { jenis_pipeline: 'adendum_dropping', tahap: 'drafting_adendum', urutan: 1, is_wajib: true, default_sla_days: 14, handler_role: 'case_manager', description: 'Auto-assign, drafting per target' },
  { jenis_pipeline: 'adendum_dropping', tahap: 'approval_kabid', urutan: 2, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'adendum_dropping', tahap: 'review_legal_rs', urutan: 3, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review Legal RS' },
  { jenis_pipeline: 'adendum_dropping', tahap: 'tanda_tangan', urutan: 4, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'TTD basah' },

  // ADENDUM MASAL (3 tahap)
  { jenis_pipeline: 'adendum_masal', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS submit form placeholder' },
  { jenis_pipeline: 'adendum_masal', tahap: 'ditinjau', urutan: 2, is_wajib: true, default_sla_days: 3, handler_role: 'case_manager', description: 'CM group review: setuju/tolak bareng' },
  { jenis_pipeline: 'adendum_masal', tahap: 'completed', urutan: 3, is_wajib: true, default_sla_days: 0, handler_role: 'case_manager', description: 'Auto-complete: PDF siap print TTD basah' },

  // PERUBAHAN DATA (5 tahap — skip kredensialing & kajian tarif)
  { jenis_pipeline: 'perubahan_data', tahap: 'diajukan', urutan: 1, is_wajib: true, default_sla_days: 1, handler_role: 'pic_rs', description: 'PIC RS ajukan perubahan data' },
  { jenis_pipeline: 'perubahan_data', tahap: 'ditinjau', urutan: 2, is_wajib: true, default_sla_days: 2, handler_role: 'case_manager', description: 'CM review' },
  { jenis_pipeline: 'perubahan_data', tahap: 'drafting_adendum', urutan: 3, is_wajib: true, default_sla_days: 3, handler_role: 'case_manager', description: 'Draft adendum perubahan data' },
  { jenis_pipeline: 'perubahan_data', tahap: 'approval_kabid', urutan: 4, is_wajib: true, default_sla_days: 2, handler_role: 'kepala_bidang', description: 'Approval Kabid' },
  { jenis_pipeline: 'perubahan_data', tahap: 'review_legal_rs', urutan: 5, is_wajib: true, default_sla_days: 5, handler_role: 'legal_rs', description: 'Review Legal RS' },
  { jenis_pipeline: 'perubahan_data', tahap: 'tanda_tangan', urutan: 6, is_wajib: true, default_sla_days: 3, handler_role: 'kepala_bidang', description: 'TTD basah' },
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

// ============================================================
// DOKUMEN REQUIREMENTS — File wajib per jenis pengajuan
// ============================================================
// PIC RS / CM wajib upload semua file ini sebelum pipeline bisa advance.
// Mekanisme: upload sekaligus di form awal, baru submit.
// Enum value must match wpa_dokumen_pengajuan_jenis in DB.
// ============================================================

export interface DokumenRequirement {
  jenis: string  // matches wpa_dokumen_pengajuan_jenis enum
  label: string
  description: string
  accept: string  // MIME types accepted
  wajib: boolean
}

export const DOKUMEN_REQUIREMENTS: Record<string, DokumenRequirement[]> = {
  // PKS Baru — 7 file wajib (CM yang upload, dari surat fisik)
  pks_baru: [
    { jenis: 'surat_pengantar_kerjasama', label: 'Surat Pengantar Permohonan Kerjasama', description: 'Surat resmi dari RS/Klinik kepada BPJS Ketenagakerjaan', accept: '.pdf,.doc,.docx', wajib: true },
    { jenis: 'company_profile', label: 'Company Profile Faskes', description: 'Profil singkat faskes: sejarah, layanan, fasilitas', accept: '.pdf,.doc,.docx', wajib: true },
    { jenis: 'tarif_diajukan', label: 'Tarif yang Diajukan', description: 'Daftar tarif layanan yang diajukan ke BPJS', accept: '.pdf,.xlsx,.xls,.csv', wajib: true },
    { jenis: 'akta_pendirian', label: 'Akta Pendirian Faskes', description: 'Akta notaris pendirian RS/Klinik', accept: '.pdf', wajib: true },
    { jenis: 'izin_operasional', label: 'Izin Operasional', description: 'Surat izin operasional dari Dinkes', accept: '.pdf', wajib: true },
    { jenis: 'npwp', label: 'NPWP Faskes', description: 'NPWP perusahaan/faskes (bukan perorangan)', accept: '.pdf,.jpg,.png', wajib: true },
    { jenis: 'sk_pj', label: 'SK Penunjukan Penanggung Jawab', description: 'SK resmi penunjukan PJ faskes', accept: '.pdf', wajib: true },
  ],

  // Perpanjangan — 2 file wajib (PIC RS yang upload)
  perpanjangan: [
    { jenis: 'surat_permohonan_perpanjangan', label: 'Surat Permohonan Perpanjangan PKS', description: 'Surat resmi dari RS/Klinik memohon perpanjangan PKS', accept: '.pdf,.doc,.docx', wajib: true },
    { jenis: 'tarif_diajukan', label: 'Tarif yang Diajukan', description: 'Daftar tarif terkini untuk PKS baru', accept: '.pdf,.xlsx,.xls,.csv', wajib: true },
  ],

  // Adendum Tarif — 3 file wajib
  adendum_harga: [
    { jenis: 'surat_pengantar_adendum', label: 'Surat Pengantar Adendum', description: 'Surat resmi dari RS/Klinik mengajukan adendum tarif', accept: '.pdf,.doc,.docx', wajib: true },
    { jenis: 'lampiran_adendum', label: 'Lampiran Detail Perubahan Tarif', description: 'Detail tarif lama vs tarif baru per item layanan', accept: '.pdf,.xlsx,.xls', wajib: true },
    { jenis: 'tarif_diajukan', label: 'Tarif Baru yang Diajukan', description: 'Daftar tarif baru lengkap', accept: '.pdf,.xlsx,.xls,.csv', wajib: true },
  ],

  // Adendum Layanan Baru — 3 file wajib (same shape as adendum_harga)
  adendum_layanan_baru: [
    { jenis: 'surat_pengantar_adendum', label: 'Surat Pengantar Adendum', description: 'Surat resmi dari RS/Klinik mengajukan layanan baru', accept: '.pdf,.doc,.docx', wajib: true },
    { jenis: 'lampiran_adendum', label: 'Lampiran Detail Layanan Baru', description: 'Detail layanan baru: nama, deskripsi, kode, tarif', accept: '.pdf,.xlsx,.xls', wajib: true },
    { jenis: 'tarif_diajukan', label: 'Tarif Layanan Baru', description: 'Daftar tarif untuk layanan baru yang diajukan', accept: '.pdf,.xlsx,.xls,.csv', wajib: true },
  ],

  // Adendum Perubahan Data — 2 file wajib (tanpa tarif)
  perubahan_data: [
    { jenis: 'surat_pengantar_adendum', label: 'Surat Pengantar Adendum', description: 'Surat resmi dari RS/Klinik mengajukan perubahan data', accept: '.pdf,.doc,.docx', wajib: true },
    { jenis: 'lampiran_adendum', label: 'Lampiran Detail Perubahan Data', description: 'Detail perubahan: field lama → field baru + dokumen pendukung (SK, akta, dll)', accept: '.pdf,.jpg,.png', wajib: true },
  ],

  // Adendum Dropping Pusat — tidak ada file dari PIC RS (CM yang handle)
  adendum_dropping: [],
}

// Helper: validate that all wajib files are present
export function validateDokumen(jenisPipeline: string, uploadedJenisList: string[]): { valid: boolean; missing: string[] } {
  const reqs = DOKUMEN_REQUIREMENTS[jenisPipeline] || []
  const wajibJenis = reqs.filter(r => r.wajib).map(r => r.jenis)
  const uploadedSet = new Set(uploadedJenisList)
  const missing = wajibJenis.filter(j => !uploadedSet.has(j))
  return { valid: missing.length === 0, missing }
}

// Helper: get label for a jenis (for display in lists)
export function getDokumenLabel(jenis: string): string {
  for (const reqs of Object.values(DOKUMEN_REQUIREMENTS)) {
    const found = reqs.find(r => r.jenis === jenis)
    if (found) return found.label
  }
  // Fallback to existing enum values not in requirements
  const labels: Record<string, string> = {
    surat_pengajuan: 'Surat Pengajuan',
    akta_pendirian: 'Akta Pendirian',
    izin_operasional: 'Izin Operasional',
    npwp: 'NPWP',
    sip_dokter: 'SIP Dokter',
    str_dokter: 'STR Dokter',
    sk_pj: 'SK Penanggung Jawab',
    daftar_tenaga_medis: 'Daftar Tenaga Medis',
    surat_kuasa: 'Surat Kuasa',
    lainnya: 'Lainnya',
  }
  return labels[jenis] || jenis.replace(/_/g, ' ')
}
