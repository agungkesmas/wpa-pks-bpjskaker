-- ============================================================
-- MIGRATION: Adendum Masal (Template-driven, PIC RS submit, CM group review)
-- ============================================================
-- Skema:
--   1. PIC RS klik kartu coklat "Adendum Masal XXX" (dari template is_masal=true)
--   2. Isi placeholder (auto-scan dari .docx)
--   3. Review + submit → pipeline masuk antrian CM
--   4. CM group review: ceklis multi → setuju/tolak bareng
--   5. Kalau setuju → auto-generate PDF (siap print TTD basah)
--
-- Tahap pipeline adendum_masal (3 tahap):
--   1. diajukan   (PIC RS)
--   2. ditinjau   (CM group review)
--   3. completed  (auto generate PDF)
-- ============================================================

-- 1. Tambah jenis 'adendum_masal' ke wpa_pipeline.jenis check constraint
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

-- 2. Tambah kolom di wpa_pks_template untuk mark template masal
alter table wpa_pks_template
  add column if not exists is_masal boolean default false,
  add column if not exists judul_kartu text;

comment on column wpa_pks_template.is_masal is 'True jika template ini adalah adendum masal dari kantor pusat. Akan muncul sebagai kartu coklat di menu Buat Pengajuan PIC RS.';
comment on column wpa_pks_template.judul_kartu is 'Judul yang ditampilkan di kartu PIC RS. Contoh: "Perubahan Pasal 4.c Rawat Inup". Hanya berlaku jika is_masal=true.';

-- 3. Tambah kolom template_id di wpa_pipeline (link pipeline ke template)
alter table wpa_pipeline
  add column if not exists template_id uuid references wpa_pks_template(id) on delete set null;
create index if not exists idx_wpa_pipeline_template on wpa_pipeline(template_id) where template_id is not null;

-- 4. Tambah kolom pdf_generated_url di wpa_pipeline (untuk simpan PDF hasil generate)
alter table wpa_pipeline
  add column if not exists pdf_generated_url text;
comment on column wpa_pipeline.pdf_generated_url is 'URL ke PDF adendum yang sudah di-generate (siap print TTD basah). Hanya untuk adendum_masal yang sudah disetujui CM.';

-- 5. Buat tabel wpa_pipeline_placeholder_values (simpan isi form placeholder per pipeline)
--    Note: we use a separate table (not wpa_pks_template_placeholder which is for template DEFINITION)
--    because we need to store the VALUES per pipeline instance.
create table if not exists wpa_pipeline_placeholder_values (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references wpa_pipeline(id) on delete cascade,
  template_id uuid references wpa_pks_template(id) on delete set null,
  placeholder_key text not null,
  placeholder_value text,
  placeholder_label text,  -- label human-readable (untuk display di UI CM)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(pipeline_id, placeholder_key)
);
create index if not exists idx_wpa_placeholder_pipeline on wpa_pipeline_placeholder_values(pipeline_id);

-- 6. Seed tahap config untuk adendum_masal (3 tahap)
insert into wpa_pipeline_tahap_config (jenis_pipeline, tahap, urutan, is_wajib, default_sla_days, handler_role, description) values
  ('adendum_masal', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS submit form placeholder adendum masal'),
  ('adendum_masal', 'ditinjau', 2, true, 3, 'case_manager', 'CM group review: ceklis multi, setuju/tolak bareng'),
  ('adendum_masal', 'completed', 3, true, 0, 'system', 'Auto-complete: generate PDF siap print TTD basah')
on conflict (jenis_pipeline, tahap) do update set
  urutan = excluded.urutan,
  is_wajib = excluded.is_wajib,
  default_sla_days = excluded.default_sla_days,
  handler_role = excluded.handler_role,
  description = excluded.description;

-- 7. Reload PostgREST schema cache
notify pgrst, 'reload schema';
