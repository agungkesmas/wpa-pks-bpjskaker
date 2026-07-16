// ============================================================
// PKS PLACEHOLDERS — 81 placeholder dari template PKS PLKK 2026
// ============================================================
// Sumber: extract dari PKS_PLKK_2026_TEMPLATE_BERSIH.docx
// Dipakai untuk:
// 1. Template batch upload faskes (81 kolom = 81 placeholder)
// 2. Auto-clone saat perpanjangan (copy data_jsonb dari PKS lama)
// 3. Auto-fill saat drafting PKS (replace {{KEY}} dengan nilai dari data_jsonb)
// ============================================================

export interface PKSPlaceholder {
  key: string          // NAMA_FASKES (tanpa {{}})
  label: string        // Nama Faskes
  kategori: string     // identitas_faskes, identitas_bpjs, tanggal, bank, dll
  auto_clone: boolean  // true = ikut di-clone saat perpanjangan, false = kosongkan (tanggal, nomor baru)
}

export const PKS_PLACEHOLDERS: PKSPlaceholder[] = [
  // === IDENTITAS FASKES (auto_clone: true) ===
  { key: 'NAMA_FASKES', label: 'Nama Faskes', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'ALAMAT_FASKES', label: 'Alamat Faskes', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'JENIS_FASKES', label: 'Jenis Faskes', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'BENTUK_FASKES', label: 'Bentuk Faskes (Pemda/Swasta dll)', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'NOMOR_AKTA_PENDIRIAN', label: 'Nomor Akta Pendirian', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'TANGGAL_AKTA_PENDIRIAN', label: 'Tanggal Akta Pendirian', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'JENIS_AKTA_PENDIRIAN', label: 'Jenis Akta Pendirian', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'NAMA_PENANDATANGAN_PIHAK_KEDUA', label: 'Nama Penandatangan Pihak Kedua (Faskes)', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'JABATAN_PENANDATANGAN_PIHAK_KEDUA', label: 'Jabatan Penandatangan Pihak Kedua', kategori: 'Identitas Faskes', auto_clone: true },
  { key: 'DASAR_KEWENANGAN_PIHAK_KEDUA', label: 'Dasar Kewenangan Pihak Kedua', kategori: 'Identitas Faskes', auto_clone: true },

  // === IDENTITAS KANTOR BPJS (auto_clone: true) ===
  { key: 'NAMA_KANTOR_CABANG', label: 'Nama Kantor Cabang BPJS', kategori: 'Identitas BPJS', auto_clone: true },
  { key: 'ALAMAT_KANTOR_CABANG', label: 'Alamat Kantor Cabang BPJS', kategori: 'Identitas BPJS', auto_clone: true },
  { key: 'NAMA_KEPALA_KANTOR_CABANG', label: 'Nama Kepala Kantor Cabang', kategori: 'Identitas BPJS', auto_clone: true },
  { key: 'TELP_FAX_BPJS', label: 'Telp/Fax BPJS', kategori: 'Identitas BPJS', auto_clone: true },
  { key: 'NOMOR_KEP_DIREKSI', label: 'Nomor Kep Direksi', kategori: 'Identitas BPJS', auto_clone: true },
  { key: 'JUDUL_KEP_DIREKSI', label: 'Judul Kep Direksi', kategori: 'Identitas BPJS', auto_clone: true },
  { key: 'NOMOR_SURAT_KUASA', label: 'Nomor Surat Kuasa', kategori: 'Identitas BPJS', auto_clone: true },
  { key: 'TANGGAL_SURAT_KUASA', label: 'Tanggal Surat Kuasa', kategori: 'Identitas BPJS', auto_clone: true },

  // === NOMOR & TANGGAL PKS (auto_clone: FALSE — diisi baru saat perpanjangan) ===
  { key: 'NOMOR_PKS_PIHAK_PERTAMA', label: 'Nomor PKS Pihak Pertama (BPJS)', kategori: 'Nomor & Tanggal PKS', auto_clone: false },
  { key: 'NOMOR_PKS_PIHAK_KEDUA', label: 'Nomor PKS Pihak Kedua (Faskes)', kategori: 'Nomor & Tanggal PKS', auto_clone: false },
  { key: 'HARI_TANDA_TANGAN', label: 'Hari Tanda Tangan', kategori: 'Nomor & Tanggal PKS', auto_clone: false },
  { key: 'TANGGAL_TANDA_TANGAN', label: 'Tanggal Tanda Tangan', kategori: 'Nomor & Tanggal PKS', auto_clone: false },
  { key: 'KOTA_TANDA_TANGAN', label: 'Kota Tanda Tangan', kategori: 'Nomor & Tanggal PKS', auto_clone: false },
  { key: 'TANGGAL_MULAI_PKS', label: 'Tanggal Mulai PKS', kategori: 'Nomor & Tanggal PKS', auto_clone: false },
  { key: 'TANGGAL_BERAKHIR_PKS', label: 'Tanggal Berakhir PKS', kategori: 'Nomor & Tanggal PKS', auto_clone: false },

  // === PKS SEBELUMNYA (auto_clone: false — diisi saat perpanjangan) ===
  { key: 'NOMOR_PKS_SEBELUMNYA_PIHAK_PERTAMA', label: 'Nomor PKS Sebelumnya Pihak Pertama', kategori: 'PKS Sebelumnya', auto_clone: false },
  { key: 'NOMOR_PKS_SEBELUMNYA_PIHAK_KEDUA', label: 'Nomor PKS Sebelumnya Pihak Kedua', kategori: 'PKS Sebelumnya', auto_clone: false },
  { key: 'PERIHAL_PKS_SEBELUMNYA', label: 'Perihal PKS Sebelumnya', kategori: 'PKS Sebelumnya', auto_clone: false },
  { key: 'TANGGAL_BERAKHIR_PKS_SEBELUMNYA', label: 'Tanggal Berakhir PKS Sebelumnya', kategori: 'PKS Sebelumnya', auto_clone: false },

  // === BANK (auto_clone: true) ===
  { key: 'NAMA_BANK', label: 'Nama Bank', kategori: 'Bank', auto_clone: true },
  { key: 'CABANG_BANK', label: 'Cabang Bank', kategori: 'Bank', auto_clone: true },
  { key: 'NOMOR_REKENING', label: 'Nomor Rekening', kategori: 'Bank', auto_clone: true },
  { key: 'NAMA_REKENING', label: 'Nama Rekening', kategori: 'Bank', auto_clone: true },

  // === TARIF (auto_clone: false — diisi saat kajian tarif) ===
  { key: 'JENIS_TARIF_KK_PAK', label: 'Jenis Tarif KK Pakai', kategori: 'Tarif', auto_clone: false },
  { key: 'KELAS_RAWAT_INAP_KK_PAK', label: 'Kelas Rawat Inap KK Pakai', kategori: 'Tarif', auto_clone: false },
  { key: 'NAMA_RS_PEMERINTAH_DAERAH', label: 'Nama RS Pemerintah Daerah (acuan)', kategori: 'Tarif', auto_clone: false },
  { key: 'ACUAN_TARIF_RS_PEMERINTAH', label: 'Acuan Tarif RS Pemerintah', kategori: 'Tarif', auto_clone: false },
  { key: 'NAMA_RS_PEMERINTAH_PROVINSI', label: 'Nama RS Pemerintah Provinsi (acuan)', kategori: 'Tarif', auto_clone: false },
  { key: 'TAHUN_TARIF_NEGOSIASI', label: 'Tahun Tarif Negosiasi', kategori: 'Tarif', auto_clone: false },

  // === BA NEGOSIASI (auto_clone: false) ===
  { key: 'NOMOR_BA_NEGOSIASI', label: 'Nomor BA Negosiasi', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'HARI_NEGOSIASI', label: 'Hari Negosiasi', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'TANGGAL_NEGOSIASI', label: 'Tanggal Negosiasi', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'BULAN_NEGOSIASI', label: 'Bulan Negosiasi', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'TAHUN_NEGOSIASI', label: 'Tahun Negosiasi', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'JAM_NEGOSIASI', label: 'Jam Negosiasi', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'TANGGAL_PENAWARAN', label: 'Tanggal Penawaran', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'BULAN_PENAWARAN', label: 'Bulan Penawaran', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'TAHUN_PENAWARAN', label: 'Tahun Penawaran', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'NAMA_SAKSI_PIHAK_PERTAMA', label: 'Nama Saksi Pihak Pertama', kategori: 'BA Negosiasi', auto_clone: false },
  { key: 'NAMA_SAKSI_PIHAK_KEDUA', label: 'Nama Saksi Pihak Kedua', kategori: 'BA Negosiasi', auto_clone: false },

  // === REKONSILIASI (auto_clone: false) ===
  { key: 'TANGGAL_REKONSILIASI', label: 'Tanggal Rekonsiliasi', kategori: 'Rekonsiliasi', auto_clone: false },
  { key: 'BULAN_REKONSILIASI', label: 'Bulan Rekonsiliasi', kategori: 'Rekonsiliasi', auto_clone: false },
  { key: 'TAHUN_REKONSILIASI', label: 'Tahun Rekonsiliasi', kategori: 'Rekonsiliasi', auto_clone: false },
  { key: 'BULAN_AWAL_REKONSILIASI', label: 'Bulan Awal Rekonsiliasi', kategori: 'Rekonsiliasi', auto_clone: false },
  { key: 'BULAN_AKHIR_REKONSILIASI', label: 'Bulan Akhir Rekonsiliasi', kategori: 'Rekonsiliasi', auto_clone: false },

  // === INFORMASI KELENGKAPAN (auto_clone: false) ===
  { key: 'NOMOR_INFORMASI_KELENGKAPAN', label: 'Nomor Informasi Kelengkapan', kategori: 'Informasi Kelengkapan', auto_clone: false },
  { key: 'TANGGAL_INFORMASI_KELENGKAPAN', label: 'Tanggal Informasi Kelengkapan', kategori: 'Informasi Kelengkapan', auto_clone: false },
  { key: 'BULAN_INFORMASI_KELENGKAPAN', label: 'Bulan Informasi Kelengkapan', kategori: 'Informasi Kelengkapan', auto_clone: false },
  { key: 'TAHUN_INFORMASI_KELENGKAPAN', label: 'Tahun Informasi Kelengkapan', kategori: 'Informasi Kelengkapan', auto_clone: false },
  { key: 'BULAN_PELAYANAN', label: 'Bulan Pelayanan', kategori: 'Informasi Kelengkapan', auto_clone: false },
  { key: 'TAHUN_PELAYANAN', label: 'Tahun Pelayanan', kategori: 'Informasi Kelengkapan', auto_clone: false },
  { key: 'JUMLAH_KASUS_TIDAK_LENGKAP', label: 'Jumlah Kasus Tidak Lengkap', kategori: 'Informasi Kelengkapan', auto_clone: false },
  { key: 'BATAS_HARI_PENLENGKAPAN', label: 'Batas Hari Penlengkapan', kategori: 'Informasi Kelengkapan', auto_clone: false },

  // === PIC & KONTAK (auto_clone: true) ===
  { key: 'NAMA_PIC_USER_EPLKK', label: 'Nama PIC User EPLKK', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'JABATAN_PIC_USER_EPLKK', label: 'Jabatan PIC User EPLKK', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'NAMA_PIC_NARAHUBUNG', label: 'Nama PIC Narahubung', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'JABATAN_PIC_NARAHUBUNG', label: 'Jabatan PIC Narahubung', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'JABATAN_PIC_BPJS', label: 'Jabatan PIC BPJS', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'HP_PIC_BPJS', label: 'HP PIC BPJS', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'EMAIL_PIC_BPJS', label: 'Email PIC BPJS', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'JABATAN_PIC_ADMIN_FASKES', label: 'Jabatan PIC Admin Faskes', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'HP_PIC_ADMIN_FASKES', label: 'HP PIC Admin Faskes', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'EMAIL_PIC_ADMIN_FASKES', label: 'Email PIC Admin Faskes', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'JABATAN_PIC_KLINIS_FASKES', label: 'Jabatan PIC Klinis Faskes', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'HP_PIC_KLINIS_FASKES', label: 'HP PIC Klinis Faskes', kategori: 'PIC & Kontak', auto_clone: true },
  { key: 'EMAIL_PIC_KLINIS_FASKES', label: 'Email PIC Klinis Faskes', kategori: 'PIC & Kontak', auto_clone: true },

  // === PAKTA & LAINNYA (auto_clone: false) ===
  { key: 'TEMPAT_PAKTA', label: 'Tempat Pakta', kategori: 'Pakta & Lainnya', auto_clone: false },
  { key: 'BULAN_PAKTA', label: 'Bulan Pakta', kategori: 'Pakta & Lainnya', auto_clone: false },
  { key: 'NAMA_PIMPINAN_FASKES', label: 'Nama Pimpinan Faskes', kategori: 'Pakta & Lainnya', auto_clone: true },
  { key: 'JABATAN_PIMPINAN_FASKES', label: 'Jabatan Pimpinan Faskes', kategori: 'Pakta & Lainnya', auto_clone: true },
  { key: 'KOTA_PENGADILAN_NEGERI', label: 'Kota Pengadilan Negeri', kategori: 'Pakta & Lainnya', auto_clone: true },
]

// Helper: get placeholder keys that should be auto-cloned
export function getAutoCloneKeys(): string[] {
  return PKS_PLACEHOLDERS.filter(p => p.auto_clone).map(p => p.key)
}

// Helper: get placeholder keys that should be emptied (not cloned)
export function getResetKeys(): string[] {
  return PKS_PLACEHOLDERS.filter(p => !p.auto_clone).map(p => p.key)
}

// Helper: clone data_jsonb for perpanjangan (keep auto_clone fields, reset others)
export function cloneDataForPerpanjangan(oldData: Record<string, any>): Record<string, any> {
  const cloned: Record<string, any> = {}
  for (const p of PKS_PLACEHOLDERS) {
    if (p.auto_clone && oldData[p.key] !== undefined) {
      cloned[p.key] = oldData[p.key]
    } else {
      cloned[p.key] = null  // reset
    }
  }
  // Special: NOMOR_PKS_SEBELUMNYA diisi dari PKS lama
  if (oldData['NOMOR_PKS_PIHAK_PERTAMA']) {
    cloned['NOMOR_PKS_SEBELUMNYA_PIHAK_PERTAMA'] = oldData['NOMOR_PKS_PIHAK_PERTAMA']
  }
  if (oldData['NOMOR_PKS_PIHAK_KEDUA']) {
    cloned['NOMOR_PKS_SEBELUMNYA_PIHAK_KEDUA'] = oldData['NOMOR_PKS_PIHAK_KEDUA']
  }
  if (oldData['TANGGAL_BERAKHIR_PKS']) {
    cloned['TANGGAL_BERAKHIR_PKS_SEBELUMNYA'] = oldData['TANGGAL_BERAKHIR_PKS']
  }
  if (oldData['PERIHAL_PKS_SEBELUMNYA'] || oldData['NOMOR_PKS_PIHAK_PERTAMA']) {
    cloned['PERIHAL_PKS_SEBELUMNYA'] = oldData['PERIHAL_PKS_SEBELUMNYA'] || `PKS ${oldData['NOMOR_PKS_PIHAK_PERTAMA'] || ''}`
  }
  return cloned
}

// Helper: group by kategori
export function getPlaceholdersByKategori(): Record<string, PKSPlaceholder[]> {
  const grouped: Record<string, PKSPlaceholder[]> = {}
  for (const p of PKS_PLACEHOLDERS) {
    if (!grouped[p.kategori]) grouped[p.kategori] = []
    grouped[p.kategori].push(p)
  }
  return grouped
}
