-- ============================================================
-- MIGRATION: Extend enum wpa_dokumen_pengajuan_jenis
-- ============================================================
-- Tambah jenis dokumen baru untuk:
-- - PKS Baru: surat_pengantar_kerjasama, company_profile, tarif_diajukan, sk_penunjukan_pj
-- - Perpanjangan: surat_permohonan_perpanjangan, tarif_diajukan (reuse)
-- - Adendum: surat_pengantar_adendum, lampiran_adendum
--
-- Existing enum values (jangan dihapus):
--   surat_pengajuan, akta_pendirian, izin_operasional, npwp,
--   sip_dokter, str_dokter, sk_pj, daftar_tenaga_medis,
--   surat_kuasa, lainnya
-- ============================================================

do $$ begin
  -- Add new values to enum (PostgreSQL 10+ supports IF NOT EXISTS via exception catch)
  alter type wpa_dokumen_pengajuan_jenis add value if not exists 'surat_pengantar_kerjasama';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type wpa_dokumen_pengajuan_jenis add value if not exists 'company_profile';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type wpa_dokumen_pengajuan_jenis add value if not exists 'tarif_diajukan';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type wpa_dokumen_pengajuan_jenis add value if not exists 'surat_permohonan_perpanjangan';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type wpa_dokumen_pengajuan_jenis add value if not exists 'surat_pengantar_adendum';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type wpa_dokumen_pengajuan_jenis add value if not exists 'lampiran_adendum';
exception when duplicate_object then null; end $$;

-- Reload PostgREST schema cache so the new enum values are visible
notify pgrst, 'reload schema';

-- ============================================================
-- NOTE: sk_pj (SK Penunjukan PJ) sudah ada di enum lama, jadi tidak perlu tambah lagi.
-- NPWP, akta_pendirian, izin_operasional juga sudah ada.
-- ============================================================
