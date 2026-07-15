-- ============================================================
-- MIGRATION: Dropping Pusat Hybrid + Tahap Rename
-- ============================================================
-- 1. Rename `negosiasi_tarif` → `tinjauan_tarif` in:
--    - wpa_pipeline.current_tahap (in-flight pipelines)
--    - wpa_pipeline_log.tahap / from_tahap / to_tahap (historical)
--    - wpa_pipeline_tahap_config (already handled by wpa_plkk_final_schema.sql seed)
-- 2. Add 'adendum_layanan_baru' to wpa_pipeline.jenis check constraint
-- 3. Create wpa_dropping_pusat_batch table (header — one per CM/Kabid broadcast)
-- 4. Create wpa_dropping_pusat_exclude table (faskes yang di-uncheck + alasan)
-- 5. Add metadata column to wpa_pipeline for linking to batch
-- ============================================================

-- 1. Rename negosiasi_tarif → tinjauan_tarif in flight data
update wpa_pipeline set current_tahap = 'tinjauan_tarif' where current_tahap = 'negosiasi_tarif';
update wpa_pipeline_log set tahap = 'tinjauan_tarif' where tahap = 'negosiasi_tarif';
update wpa_pipeline_log set from_tahap = 'tinjauan_tarif' where from_tahap = 'negosiasi_tarif';
update wpa_pipeline_log set to_tahap = 'tinjauan_tarif' where to_tahap = 'negosiasi_tarif';

-- 2. Add 'adendum_layanan_baru' to wpa_pipeline.jenis check constraint
--    (drop existing constraint and recreate with extended enum)
do $$ begin
  -- Try to drop if exists
  alter table wpa_pipeline drop constraint if exists wpa_pipeline_jenis_check;
exception when others then null; end $$;

alter table wpa_pipeline
  add constraint wpa_pipeline_jenis_check
  check (jenis in (
    'faskes_baru', 'pks_baru',
    'adendum_harga', 'adendum_layanan_baru', 'adendum_dropping',
    'perpanjangan', 'perubahan_data'
  ));

-- 3. wpa_dropping_pusat_batch — header record per CM/Kabid broadcast
create table if not exists wpa_dropping_pusat_batch (
  id uuid primary key default gen_random_uuid(),
  kantor_cabang_id uuid not null references wpa_kantor_cabang(id) on delete cascade,
  template_id uuid references wpa_templates(id) on delete set null,
  no_surat_pusat text not null,
  tanggal_surat_pusat date not null,
  perihal text not null,
  surat_acuan_url text,
  catatan text,
  initiated_by uuid not null references wpa_users(id) on delete set null,
  initiated_at timestamptz default now(),
  total_faskes_aktif int default 0,    -- jumlah faskes in cabang when batch created
  total_faskes_diproses int default 0, -- jumlah yang dicentang (= create pipeline)
  total_faskes_dikecualikan int default 0, -- jumlah yang di-uncheck + alasan
  metadata jsonb
);
create index if not exists idx_wpa_dropping_batch_cabang on wpa_dropping_pusat_batch(kantor_cabang_id, initiated_at);

-- 4. wpa_dropping_pusat_exclude — faskes yang di-uncheck + wajib alasan
--    (audit trail: kalau BPJS pusat tanya "kenapa X tidak dapat?", CM punya jawaban)
create table if not exists wpa_dropping_pusat_exclude (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references wpa_dropping_pusat_batch(id) on delete cascade,
  faskes_id uuid not null references wpa_faskes(id) on delete cascade,
  alasan_exclude text not null, -- wajib diisi
  excluded_by uuid not null references wpa_users(id) on delete set null,
  excluded_at timestamptz default now()
);
create index if not exists idx_wpa_dropping_exclude_batch on wpa_dropping_pusat_exclude(batch_id);
create index if not exists idx_wpa_dropping_exclude_faskes on wpa_dropping_pusat_exclude(faskes_id);

-- 5. Add batch_id to wpa_pipeline (link pipeline → batch)
alter table wpa_pipeline
  add column if not exists dropping_batch_id uuid references wpa_dropping_pusat_batch(id) on delete set null;
create index if not exists idx_wpa_pipeline_dropping_batch on wpa_pipeline(dropping_batch_id) where dropping_batch_id is not null;

-- 6. Reload PostgREST schema cache
notify pgrst, 'reload schema';
