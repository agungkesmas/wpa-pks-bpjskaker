-- ============================================================
-- MIGRATION: Rename tahap pipeline ke 6 tahap ringkas
-- ============================================================
-- Alur baru: Pengajuan → Peninjauan & Kajian Tarif → Kredensialing → Drafting → Approval & Review → Tanda Tangan
--
-- Rename:
--   ditinjau           → ditinjau_kajian_tarif (untuk pks_baru, perpanjangan, adendum_harga, adendum_layanan_baru)
--   kredensialing_ulang → kredensialing (seragam)
--   tinjauan_tarif     → dihapus (digabung ke ditinjau_kajian_tarif)
--   negosiasi_tarif    → dihapus (sudah diganti sebelumnya)
--
-- Pipeline yang masih in-progress dengan tahap lama akan di-migrate ke tahap baru.
-- ============================================================

-- 1. Rename tahap di wpa_pipeline.current_tahap
update wpa_pipeline set current_tahap = 'ditinjau_kajian_tarif'
  where current_tahap = 'ditinjau' and jenis in ('pks_baru', 'perpanjangan', 'adendum_harga', 'adendum_layanan_baru');

update wpa_pipeline set current_tahap = 'kredensialing'
  where current_tahap = 'kredensialing_ulang';

-- Pipeline yang di tahap tinjauan_tarif → pindah ke kredensialing (karena tinjauan_tarif digabung ke ditinjau_kajian_tarif yang sudah lewat)
update wpa_pipeline set current_tahap = 'kredensialing'
  where current_tahap = 'tinjauan_tarif';

-- Pipeline yang di tahap negosiasi_tarif (kalau masih ada) → pindah ke kredensialing
update wpa_pipeline set current_tahap = 'kredensialing'
  where current_tahap = 'negosiasi_tarif';

-- 2. Rename tahap di wpa_pipeline_log (historical data)
update wpa_pipeline_log set tahap = 'ditinjau_kajian_tarif'
  where tahap = 'ditinjau' and pipeline_id in (
    select id from wpa_pipeline where jenis in ('pks_baru', 'perpanjangan', 'adendum_harga', 'adendum_layanan_baru')
  );

update wpa_pipeline_log set tahap = 'kredensialing' where tahap = 'kredensialing_ulang';
update wpa_pipeline_log set tahap = 'kredensialing' where tahap = 'tinjauan_tarif';
update wpa_pipeline_log set tahap = 'kredensialing' where tahap = 'negosiasi_tarif';
update wpa_pipeline_log set from_tahap = 'ditinjau_kajian_tarif' where from_tahap = 'ditinjau';
update wpa_pipeline_log set to_tahap = 'ditinjau_kajian_tarif' where to_tahap = 'ditinjau';
update wpa_pipeline_log set from_tahap = 'kredensialing' where from_tahap = 'kredensialing_ulang';
update wpa_pipeline_log set to_tahap = 'kredensialing' where to_tahap = 'kredensialing_ulang';
update wpa_pipeline_log set from_tahap = 'kredensialing' where from_tahap = 'tinjauan_tarif';
update wpa_pipeline_log set to_tahap = 'kredensialing' where to_tahap = 'tinjauan_tarif';

-- 3. Hapus config tahap lama + seed ulang dengan 6 tahap
delete from wpa_pipeline_tahap_config
  where tahap in ('negosiasi_tarif', 'tinjauan_tarif', 'kredensialing_ulang', 'ditinjau');

-- 4. Seed ulang tahap config (6 tahap per jenis)
insert into wpa_pipeline_tahap_config (jenis_pipeline, tahap, urutan, is_wajib, default_sla_days, handler_role, description) values
  -- PKS BARU (6 tahap)
  ('pks_baru', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS upload surat + file wajib'),
  ('pks_baru', 'ditinjau_kajian_tarif', 2, true, 3, 'case_manager', 'CM review surat + AI kajian tarif vs Bank Tarif'),
  ('pks_baru', 'kredensialing', 3, true, 5, 'case_manager', 'Asesmen mandiri (default) atau visitasi (jika red flag)'),
  ('pks_baru', 'drafting_pks', 4, true, 5, 'case_manager', 'PIC RS isi placeholder + rapihkan format'),
  ('pks_baru', 'approval_kabid', 5, true, 2, 'kepala_bidang', 'Approval Kabid (4-Eyes)'),
  ('pks_baru', 'review_legal_rs', 6, true, 5, 'legal_rs', 'Review Legal RS'),
  ('pks_baru', 'tanda_tangan', 7, true, 3, 'kepala_bidang', 'TTD basah kedua belah pihak'),

  -- PERPANJANGAN (6 tahap)
  ('perpanjangan', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS upload surat permohonan + tarif'),
  ('perpanjangan', 'ditinjau_kajian_tarif', 2, true, 3, 'case_manager', 'CM review surat + AI kajian tarif'),
  ('perpanjangan', 'kredensialing', 3, true, 5, 'case_manager', 'Asesmen mandiri/visitasi'),
  ('perpanjangan', 'drafting_pks', 4, true, 5, 'case_manager', 'PIC RS isi placeholder (auto-clone dari PKS lama)'),
  ('perpanjangan', 'approval_kabid', 5, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('perpanjangan', 'review_legal_rs', 6, true, 5, 'legal_rs', 'Review Legal RS'),
  ('perpanjangan', 'tanda_tangan', 7, true, 3, 'kepala_bidang', 'TTD basah + PKS lama berakhir'),

  -- ADENDUM HARGA (6 tahap)
  ('adendum_harga', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS ajukan perubahan tarif'),
  ('adendum_harga', 'ditinjau_kajian_tarif', 2, true, 3, 'case_manager', 'CM review + AI kajian tarif baru'),
  ('adendum_harga', 'kredensialing', 3, true, 5, 'case_manager', 'Verifikasi kredensial + dokumen pendukung tarif'),
  ('adendum_harga', 'drafting_adendum', 4, true, 5, 'case_manager', 'PIC RS isi placeholder adendum'),
  ('adendum_harga', 'approval_kabid', 5, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('adendum_harga', 'review_legal_rs', 6, true, 5, 'legal_rs', 'Review Legal RS'),
  ('adendum_harga', 'tanda_tangan', 7, true, 3, 'kepala_bidang', 'TTD basah'),

  -- ADENDUM LAYANAN BARU (6 tahap)
  ('adendum_layanan_baru', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS ajukan layanan baru'),
  ('adendum_layanan_baru', 'ditinjau_kajian_tarif', 2, true, 3, 'case_manager', 'CM review + AI kajian tarif layanan baru'),
  ('adendum_layanan_baru', 'kredensialing', 3, true, 5, 'case_manager', 'Verifikasi kredensial layanan baru'),
  ('adendum_layanan_baru', 'drafting_adendum', 4, true, 5, 'case_manager', 'PIC RS isi placeholder adendum'),
  ('adendum_layanan_baru', 'approval_kabid', 5, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('adendum_layanan_baru', 'review_legal_rs', 6, true, 5, 'legal_rs', 'Review Legal RS'),
  ('adendum_layanan_baru', 'tanda_tangan', 7, true, 3, 'kepala_bidang', 'TTD basah'),

  -- ADENDUM DROPPING (4 tahap)
  ('adendum_dropping', 'drafting_adendum', 1, true, 14, 'case_manager', 'Auto-assign, drafting per target'),
  ('adendum_dropping', 'approval_kabid', 2, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('adendum_dropping', 'review_legal_rs', 3, true, 5, 'legal_rs', 'Review Legal RS'),
  ('adendum_dropping', 'tanda_tangan', 4, true, 3, 'kepala_bidang', 'TTD basah'),

  -- ADENDUM MASAL (3 tahap)
  ('adendum_masal', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS submit form placeholder'),
  ('adendum_masal', 'ditinjau', 2, true, 3, 'case_manager', 'CM group review: setuju/tolak bareng'),
  ('adendum_masal', 'completed', 3, true, 0, 'case_manager', 'Auto-complete: PDF siap print TTD basah'),

  -- PERUBAHAN DATA (5 tahap)
  ('perubahan_data', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS ajukan perubahan data'),
  ('perubahan_data', 'ditinjau', 2, true, 2, 'case_manager', 'CM review'),
  ('perubahan_data', 'drafting_adendum', 3, true, 3, 'case_manager', 'Draft adendum perubahan data'),
  ('perubahan_data', 'approval_kabid', 4, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('perubahan_data', 'review_legal_rs', 5, true, 5, 'legal_rs', 'Review Legal RS'),
  ('perubahan_data', 'tanda_tangan', 6, true, 3, 'kepala_bidang', 'TTD basah')
on conflict (jenis_pipeline, tahap) do update set
  urutan = excluded.urutan,
  is_wajib = excluded.is_wajib,
  default_sla_days = excluded.default_sla_days,
  handler_role = excluded.handler_role,
  description = excluded.description;

-- 5. Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- 6. Verifikasi
select jenis_pipeline, tahap, urutan, default_sla_days, handler_role
from wpa_pipeline_tahap_config
where jenis_pipeline in ('pks_baru', 'perpanjangan')
order by jenis_pipeline, urutan;
