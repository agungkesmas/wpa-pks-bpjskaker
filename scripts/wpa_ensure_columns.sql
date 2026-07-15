-- ============================================================
-- MIGRATION: Ensure all required columns exist in wpa_pipeline
-- ============================================================
-- Versi: 1.0 (idempotent — aman dijalankan berulang-ulang)
--
-- Penyebab error "Pipeline tidak ditemukan" di PIC RS pengajuan detail:
-- API /api/pipeline/detail select kolom yang mungkin belum ada di DB
-- (karena migration sebelumnya gagal atau belum dijalankan).
--
-- File ini menambah SEMUA kolom yang dibutuhkan API detail, dengan
-- `add column if not exists` jadi aman dijalankan berulang kali.
--
-- Jalankan SETELAH file migration lain (final_schema, fase2, dropping, masal).
-- ============================================================

-- 1. Kolom takeover (dari wpa_fase2_schema.sql)
alter table wpa_pipeline
  add column if not exists takeover_enabled boolean default false,
  add column if not exists takeover_enabled_by uuid references wpa_users(id) on delete set null,
  add column if not exists takeover_enabled_at timestamptz,
  add column if not exists takeover_reason text;

-- 2. Kolom adendum masal (dari wpa_adendum_masal_schema.sql)
alter table wpa_pipeline
  add column if not exists template_id uuid references wpa_pks_template(id) on delete set null,
  add column if not exists pdf_generated_url text;

create index if not exists idx_wpa_pipeline_template on wpa_pipeline(template_id) where template_id is not null;

-- 3. Kolom dropping pusat (dari wpa_dropping_pusat_v2_schema.sql)
--    Note: wpa_dropping_pusat_batch tabel harus sudah ada sebelum kolom ini dibuat
--    karena ada FK reference. Kalau tabel belum ada, skip kolom ini.
do $$ begin
  -- Cek apakah tabel wpa_dropping_pusat_batch ada
  if exists (
    select 1 from information_schema.tables
    where table_name = 'wpa_dropping_pusat_batch'
  ) then
    alter table wpa_pipeline
      add column if not exists dropping_batch_id uuid references wpa_dropping_pusat_batch(id) on delete set null;
    create index if not exists idx_wpa_pipeline_dropping_batch on wpa_pipeline(dropping_batch_id) where dropping_batch_id is not null;
  end if;
exception when others then
  raise notice 'Skip dropping_batch_id: %', sqlerrm;
end $$;

-- 4. Update jenis check constraint untuk include adendum_masal (jika belum)
do $$ begin
  alter table wpa_pipeline drop constraint if exists wpa_pipeline_jenis_check;
exception when others then null; end $$;

alter table wpa_pipeline
  add constraint wpa_pipeline_jenis_check
  check (jenis in (
    'faskes_baru', 'pks_baru',
    'adendum_harga', 'adendum_layanan_baru', 'adendum_dropping', 'adendum_masal',
    'perpanjangan', 'perubahan_data'
  ));

-- 5. Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- 6. VERIFIKASI: tampilkan struktur kolom wpa_pipeline
--    (untuk konfirmasi semua kolom sudah ada)
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_name = 'wpa_pipeline'
  and column_name in (
    'id', 'jenis', 'current_tahap', 'status',
    'sla_deadline', 'sla_breached',
    'current_handler_id', 'handler_since',
    'takeover_enabled', 'takeover_enabled_by', 'takeover_enabled_at', 'takeover_reason',
    'cabang_owned',
    'initiated_by', 'initiated_at', 'completed_at', 'created_at', 'updated_at',
    'reference_id', 'reference_type',
    'kantor_cabang_id', 'faskes_id', 'pks_id',
    'template_id', 'pdf_generated_url', 'dropping_batch_id'
  )
order by column_name;
