-- ============================================================
-- MIGRATION: Replace old PKS template dengan pks_template_bersih.docx
-- ============================================================
-- Jalankan di Supabase SQL Editor.
--
-- APA YANG DILAKUKAN:
-- 1. Hapus semua record lama di wpa_pks_template_placeholder
-- 2. Hapus semua record lama di wpa_pks_template
-- 3. Insert 1 record baru: pks_template_bersih (jenis: pks_baru, is_active: true)
-- 4. Insert 91 placeholder definition ke wpa_pks_template_placeholder
--
-- SETELAH INI, USER HARUS:
-- 1. Upload file pks_template_bersih.docx ke Supabase Storage bucket 'wpa-templates'
--    Path: templates/pks_template_bersih.docx
--    Bisa via Supabase Dashboard → Storage → wpa-templates → Upload
--    ATAU via script: scripts/upload_template_to_supabase.ts (kalau ada)
--
-- TARGET DB: Supabase project hfhvsiuebrwrqmqzsroc
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Hapus placeholder definitions lama
-- ============================================================
DELETE FROM wpa_pks_template_placeholder
WHERE template_id IN (
  SELECT id FROM wpa_pks_template
);

-- ============================================================
-- 2. Hapus template records lama
-- ============================================================
DELETE FROM wpa_pks_template;

-- ============================================================
-- 3. Insert template baru (single source of truth)
-- ============================================================
-- Note: created_by diisi NULL dulu — bisa di-update kalau perlu
INSERT INTO wpa_pks_template (
  jenis_pipeline,
  nama,
  version,
  file_docx_path,
  is_active,
  created_at,
  updated_at
) VALUES (
  'pks_baru',  -- jenis_pipeline (template ini dipakai untuk pks_baru, perpanjangan, adendum_harga, adendum_layanan_baru, perubahan_data)
  'PKS PLKK 2026 - Template Bersih',
  1,
  'templates/pks_template_bersih.docx',  -- path di Supabase Storage bucket wpa-templates
  true,
  now(),
  now()
)
RETURNING id AS new_template_id \gset

-- ============================================================
-- 4. Insert 91 placeholder definitions
-- ============================================================
-- Sumber: extract dari pks_template_bersih.docx via python-docx
-- Match dengan src/lib/pks-placeholders.ts

INSERT INTO wpa_pks_template_placeholder (template_id, key, label, tipe, kategori, is_wajib, urutan) VALUES
  -- IDENTITAS FASKES (12)
  (:new_template_id, 'NAMA_FASKES', 'Nama Faskes', 'manual_required', 'Identitas Faskes', true, 1),
  (:new_template_id, 'ALAMAT_FASKES', 'Alamat Faskes', 'manual_required', 'Identitas Faskes', true, 2),
  (:new_template_id, 'JENIS_FASKES', 'Jenis Faskes', 'manual_required', 'Identitas Faskes', true, 3),
  (:new_template_id, 'BENTUK_FASKES', 'Bentuk Faskes (Pemda/Swasta dll)', 'manual_required', 'Identitas Faskes', true, 4),
  (:new_template_id, 'WEB_FASKES', 'Website Faskes', 'manual_optional', 'Identitas Faskes', false, 5),
  (:new_template_id, 'TELP_FAX_FASKES', 'Telp/Fax Faskes', 'manual_required', 'Identitas Faskes', true, 6),
  (:new_template_id, 'JENIS_AKTA_PENDIRIAN', 'Jenis Akta Pendirian', 'manual_required', 'Identitas Faskes', true, 7),
  (:new_template_id, 'NOMOR_AKTA_PENDIRIAN', 'Nomor Akta Pendirian', 'manual_required', 'Identitas Faskes', true, 8),
  (:new_template_id, 'TANGGAL_AKTA_PENDIRIAN', 'Tanggal Akta Pendirian', 'manual_required', 'Identitas Faskes', true, 9),
  (:new_template_id, 'NAMA_PENANDATANGAN_PIHAK_KEDUA', 'Nama Penandatangan Pihak Kedua (Faskes)', 'manual_required', 'Identitas Faskes', true, 10),
  (:new_template_id, 'JABATAN_PENANDATANGAN_PIHAK_KEDUA', 'Jabatan Penandatangan Pihak Kedua', 'manual_required', 'Identitas Faskes', true, 11),
  (:new_template_id, 'DASAR_KEWENANGAN_PIHAK_KEDUA', 'Dasar Kewenangan Pihak Kedua', 'manual_required', 'Identitas Faskes', true, 12),

  -- IDENTITAS BPJS (9)
  (:new_template_id, 'NAMA_KANTOR_CABANG', 'Nama Kantor Cabang BPJS', 'manual_required', 'Identitas BPJS', true, 13),
  (:new_template_id, 'ALAMAT_KANTOR_CABANG', 'Alamat Kantor Cabang BPJS', 'manual_required', 'Identitas BPJS', true, 14),
  (:new_template_id, 'NAMA_KEPALA_KANTOR_CABANG', 'Nama Kepala Kantor Cabang', 'manual_required', 'Identitas BPJS', true, 15),
  (:new_template_id, 'JABATAN_PENANDATANGAN_PIHAK_PERTAMA', 'Jabatan Penandatangan Pihak Pertama (BPJS)', 'manual_required', 'Identitas BPJS', true, 16),
  (:new_template_id, 'TELP_FAX_BPJS', 'Telp/Fax BPJS', 'manual_required', 'Identitas BPJS', true, 17),
  (:new_template_id, 'NOMOR_KEP_DIREKSI', 'Nomor Kep Direksi', 'manual_required', 'Identitas BPJS', true, 18),
  (:new_template_id, 'JUDUL_KEP_DIREKSI', 'Judul Kep Direksi', 'manual_required', 'Identitas BPJS', true, 19),
  (:new_template_id, 'NOMOR_SURAT_KUASA', 'Nomor Surat Kuasa', 'manual_required', 'Identitas BPJS', true, 20),
  (:new_template_id, 'TANGGAL_SURAT_KUASA', 'Tanggal Surat Kuasa', 'manual_required', 'Identitas BPJS', true, 21),

  -- NOMOR & TANGGAL PKS (9) — auto_clone: false
  (:new_template_id, 'NOMOR_PKS_PIHAK_PERTAMA', 'Nomor PKS Pihak Pertama (BPJS)', 'manual_required', 'Nomor & Tanggal PKS', true, 22),
  (:new_template_id, 'NOMOR_PKS_PIHAK_KEDUA', 'Nomor PKS Pihak Kedua (Faskes)', 'manual_required', 'Nomor & Tanggal PKS', true, 23),
  (:new_template_id, 'HARI_TANDA_TANGAN', 'Hari Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 24),
  (:new_template_id, 'TANGGAL_TANDA_TANGAN', 'Tanggal Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 25),
  (:new_template_id, 'BULAN_TANDA_TANGAN', 'Bulan Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 26),
  (:new_template_id, 'TAHUN_TANDA_TANGAN', 'Tahun Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 27),
  (:new_template_id, 'KOTA_TANDA_TANGAN', 'Kota Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 28),
  (:new_template_id, 'TANGGAL_MULAI_PKS', 'Tanggal Mulai PKS', 'manual_required', 'Nomor & Tanggal PKS', true, 29),
  (:new_template_id, 'TANGGAL_BERAKHIR_PKS', 'Tanggal Berakhir PKS', 'manual_required', 'Nomor & Tanggal PKS', true, 30),

  -- PKS SEBELUMNYA (4) — auto_clone: false
  (:new_template_id, 'NOMOR_PKS_SEBELUMNYA_PIHAK_PERTAMA', 'Nomor PKS Sebelumnya Pihak Pertama', 'manual_optional', 'PKS Sebelumnya', false, 31),
  (:new_template_id, 'NOMOR_PKS_SEBELUMNYA_PIHAK_KEDUA', 'Nomor PKS Sebelumnya Pihak Kedua', 'manual_optional', 'PKS Sebelumnya', false, 32),
  (:new_template_id, 'PERIHAL_PKS_SEBELUMNYA', 'Perihal PKS Sebelumnya', 'manual_optional', 'PKS Sebelumnya', false, 33),
  (:new_template_id, 'TANGGAL_BERAKHIR_PKS_SEBELUMNYA', 'Tanggal Berakhir PKS Sebelumnya', 'manual_optional', 'PKS Sebelumnya', false, 34),

  -- BANK (4) — auto_clone: true
  (:new_template_id, 'NAMA_BANK', 'Nama Bank', 'manual_required', 'Bank', true, 35),
  (:new_template_id, 'CABANG_BANK', 'Cabang Bank', 'manual_required', 'Bank', true, 36),
  (:new_template_id, 'NOMOR_REKENING', 'Nomor Rekening', 'manual_required', 'Bank', true, 37),
  (:new_template_id, 'NAMA_REKENING', 'Nama Rekening', 'manual_required', 'Bank', true, 38),

  -- TARIF (4) — auto_clone: false
  (:new_template_id, 'JENIS_TARIF_KK_PAK', 'Jenis Tarif KK Pakai', 'manual_required', 'Tarif', true, 39),
  (:new_template_id, 'KELAS_RAWAT_INAP_KK_PAK', 'Kelas Rawat Inap KK Pakai', 'manual_required', 'Tarif', true, 40),
  (:new_template_id, 'NAMA_RS_PEMERINTAH_ACUAN', 'Nama RS Pemerintah Acuan', 'manual_optional', 'Tarif', false, 41),
  (:new_template_id, 'TAHUN_TARIF_NEGOSIASI', 'Tahun Tarif Negosiasi', 'manual_required', 'Tarif', true, 42),

  -- BA NEGOSIASI (13) — auto_clone: false
  (:new_template_id, 'NOMOR_BA_NEGOSIASI', 'Nomor BA Negosiasi', 'manual_required', 'BA Negosiasi', true, 43),
  (:new_template_id, 'HARI_NEGOSIASI', 'Hari Negosiasi', 'manual_required', 'BA Negosiasi', true, 44),
  (:new_template_id, 'TANGGAL_NEGOSIASI', 'Tanggal Negosiasi', 'manual_required', 'BA Negosiasi', true, 45),
  (:new_template_id, 'BULAN_NEGOSIASI', 'Bulan Negosiasi', 'manual_required', 'BA Negosiasi', true, 46),
  (:new_template_id, 'TAHUN_NEGOSIASI', 'Tahun Negosiasi', 'manual_required', 'BA Negosiasi', true, 47),
  (:new_template_id, 'JAM_NEGOSIASI', 'Jam Negosiasi', 'manual_required', 'BA Negosiasi', true, 48),
  (:new_template_id, 'TANGGAL_PENAWARAN', 'Tanggal Penawaran', 'manual_required', 'BA Negosiasi', true, 49),
  (:new_template_id, 'BULAN_PENAWARAN', 'Bulan Penawaran', 'manual_required', 'BA Negosiasi', true, 50),
  (:new_template_id, 'TAHUN_PENAWARAN', 'Tahun Penawaran', 'manual_required', 'BA Negosiasi', true, 51),
  (:new_template_id, 'NAMA_SAKSI_PIHAK_PERTAMA', 'Nama Saksi Pihak Pertama', 'manual_required', 'BA Negosiasi', true, 52),
  (:new_template_id, 'JABATAN_SAKSI_PIHAK_PERTAMA', 'Jabatan Saksi Pihak Pertama', 'manual_required', 'BA Negosiasi', true, 53),
  (:new_template_id, 'NAMA_SAKSI_PIHAK_KEDUA', 'Nama Saksi Pihak Kedua', 'manual_required', 'BA Negosiasi', true, 54),
  (:new_template_id, 'JABATAN_SAKSI_PIHAK_KEDUA', 'Jabatan Saksi Pihak Kedua', 'manual_required', 'BA Negosiasi', true, 55),

  -- BA REKONSILIASI (6) — auto_clone: false
  (:new_template_id, 'NOMOR_BA_REKONSILIASI', 'Nomor BA Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 56),
  (:new_template_id, 'TANGGAL_REKONSILIASI', 'Tanggal Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 57),
  (:new_template_id, 'BULAN_REKONSILIASI', 'Bulan Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 58),
  (:new_template_id, 'TAHUN_REKONSILIASI', 'Tahun Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 59),
  (:new_template_id, 'BULAN_AWAL_REKONSILIASI', 'Bulan Awal Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 60),
  (:new_template_id, 'BULAN_AKHIR_REKONSILIASI', 'Bulan Akhir Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 61),

  -- INFORMASI KELENGKAPAN (8) — auto_clone: false
  (:new_template_id, 'NOMOR_INFORMASI_KELENGKAPAN', 'Nomor Informasi Kelengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 62),
  (:new_template_id, 'TANGGAL_INFORMASI_KELENGKAPAN', 'Tanggal Informasi Kelengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 63),
  (:new_template_id, 'BULAN_INFORMASI_KELENGKAPAN', 'Bulan Informasi Kelengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 64),
  (:new_template_id, 'TAHUN_INFORMASI_KELENGKAPAN', 'Tahun Informasi Kelengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 65),
  (:new_template_id, 'BULAN_PELAYANAN', 'Bulan Pelayanan', 'manual_optional', 'Informasi Kelengkapan', false, 66),
  (:new_template_id, 'TAHUN_PELAYANAN', 'Tahun Pelayanan', 'manual_optional', 'Informasi Kelengkapan', false, 67),
  (:new_template_id, 'JUMLAH_KASUS_TIDAK_LENGKAP', 'Jumlah Kasus Tidak Lengkap', 'manual_optional', 'Informasi Kelengkapan', false, 68),
  (:new_template_id, 'BATAS_HARI_PENLENGKAPAN', 'Batas Hari Penlengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 69),

  -- PIC & KONTAK (16) — auto_clone: true
  (:new_template_id, 'NAMA_PIC_USER_EPLKK', 'Nama PIC User EPLKK', 'manual_required', 'PIC & Kontak', true, 70),
  (:new_template_id, 'JABATAN_PIC_USER_EPLKK', 'Jabatan PIC User EPLKK', 'manual_required', 'PIC & Kontak', true, 71),
  (:new_template_id, 'NAMA_PIC_NARAHUBUNG', 'Nama PIC Narahubung', 'manual_required', 'PIC & Kontak', true, 72),
  (:new_template_id, 'JABATAN_PIC_NARAHUBUNG', 'Jabatan PIC Narahubung', 'manual_required', 'PIC & Kontak', true, 73),
  (:new_template_id, 'NAMA_PIC_BPJS', 'Nama PIC BPJS', 'manual_required', 'PIC & Kontak', true, 74),
  (:new_template_id, 'JABATAN_PIC_BPJS', 'Jabatan PIC BPJS', 'manual_required', 'PIC & Kontak', true, 75),
  (:new_template_id, 'HP_PIC_BPJS', 'HP PIC BPJS', 'manual_required', 'PIC & Kontak', true, 76),
  (:new_template_id, 'EMAIL_PIC_BPJS', 'Email PIC BPJS', 'manual_required', 'PIC & Kontak', true, 77),
  (:new_template_id, 'NAMA_PIC_ADMIN_FASKES', 'Nama PIC Admin Faskes', 'manual_required', 'PIC & Kontak', true, 78),
  (:new_template_id, 'JABATAN_PIC_ADMIN_FASKES', 'Jabatan PIC Admin Faskes', 'manual_required', 'PIC & Kontak', true, 79),
  (:new_template_id, 'HP_PIC_ADMIN_FASKES', 'HP PIC Admin Faskes', 'manual_required', 'PIC & Kontak', true, 80),
  (:new_template_id, 'EMAIL_PIC_ADMIN_FASKES', 'Email PIC Admin Faskes', 'manual_required', 'PIC & Kontak', true, 81),
  (:new_template_id, 'NAMA_PIC_KLINIS_FASKES', 'Nama PIC Klinis Faskes', 'manual_required', 'PIC & Kontak', true, 82),
  (:new_template_id, 'JABATAN_PIC_KLINIS_FASKES', 'Jabatan PIC Klinis Faskes', 'manual_required', 'PIC & Kontak', true, 83),
  (:new_template_id, 'HP_PIC_KLINIS_FASKES', 'HP PIC Klinis Faskes', 'manual_required', 'PIC & Kontak', true, 84),
  (:new_template_id, 'EMAIL_PIC_KLINIS_FASKES', 'Email PIC Klinis Faskes', 'manual_required', 'PIC & Kontak', true, 85),

  -- PAKTA & LAINNYA (6) — mixed
  (:new_template_id, 'TEMPAT_PAKTA', 'Tempat Pakta', 'manual_required', 'Pakta & Lainnya', true, 86),
  (:new_template_id, 'BULAN_PAKTA', 'Bulan Pakta', 'manual_required', 'Pakta & Lainnya', true, 87),
  (:new_template_id, 'TAHUN_PAKTA', 'Tahun Pakta', 'manual_required', 'Pakta & Lainnya', true, 88),
  (:new_template_id, 'NAMA_PIMPINAN_FASKES', 'Nama Pimpinan Faskes', 'manual_required', 'Pakta & Lainnya', true, 89),
  (:new_template_id, 'JABATAN_PIMPINAN_FASKES', 'Jabatan Pimpinan Faskes', 'manual_required', 'Pakta & Lainnya', true, 90),
  (:new_template_id, 'KOTA_PENGADILAN_NEGERI', 'Kota Pengadilan Negeri', 'manual_required', 'Pakta & Lainnya', true, 91);

-- ============================================================
-- 5. Verification
-- ============================================================
SELECT
  'wpa_pks_template' AS table_name,
  COUNT(*) AS record_count
FROM wpa_pks_template
WHERE is_active = true
UNION ALL
SELECT
  'wpa_pks_template_placeholder' AS table_name,
  COUNT(*) AS record_count
FROM wpa_pks_template_placeholder;

COMMIT;

-- ============================================================
-- POST-MIGRATION CHECKLIST
-- ============================================================
-- 1. Verify record count:
--    SELECT COUNT(*) FROM wpa_pks_template; -- harus 1
--    SELECT COUNT(*) FROM wpa_pks_template_placeholder; -- harus 91
--
-- 2. Upload template file ke Supabase Storage:
--    - Buka Supabase Dashboard → Storage → wpa-templates
--    - Upload file: pks_template_bersih.docx
--    - Path: templates/pks_template_bersih.docx
--    ATAU jalankan script: scripts/upload_template_to_supabase.ts
--
-- 3. Test endpoint:
--    curl https://mitra-plkk.vercel.app/api/drafting/generate-docx
--    Harus return JSON dengan 91 placeholders
--
-- 4. Test generate:
--    curl -X POST https://mitra-plkk.vercel.app/api/drafting/generate-docx \
--      -H "Content-Type: application/json" \
--      -d '{"data":{"NAMA_FASKES":"RS Test","NOMOR_PKS_PIHAK_PERTAMA":"PER/01/012026"}}' \
--      -o test_pks.docx
-- ============================================================
