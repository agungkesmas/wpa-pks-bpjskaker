-- ============================================================
-- MIGRATION: Drafting PKS dengan Lock + Version Tracking
-- ============================================================
-- Sistem:
-- - PIC RS isi placeholder + edit teks (dengan char count lock ±10%)
-- - 3x kesempatan koreksi (v1, v2, v3, v4) sebelum CM takeover
-- - Version snapshot: simpan HTML penuh per version
-- - CM takeover: pilih mode (system_edit / file_upload)
-- ============================================================

-- 1. Tabel wpa_pks_draft_versions — snapshot per iterasi
create table if not exists wpa_pks_draft_versions (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references wpa_pipeline(id) on delete cascade,

  version int not null,  -- 1, 2, 3, 4, atau null untuk 'final'
  version_label text not null default 'draft',  -- 'draft' / 'final'

  content_html text not null,  -- snapshot penuh HTML

  -- Char counts per ayat (JSON)
  -- Format: { "ayat_1": { "original": 87, "current": 89, "delta": 2, "within_tolerance": true, "reason": null },
  --           "ayat_2": { "original": 145, "current": 98, "delta": -47, "within_tolerance": false, "reason": "Hapus klausa duplikat" } }
  char_counts jsonb default '{}'::jsonb,

  -- Summary stats
  total_ayat int default 0,
  total_changes int default 0,  -- jumlah ayat yang berubah
  total_outside_tolerance int default 0,  -- jumlah ayat outside tolerance

  -- Metadata editor
  edited_by uuid not null references wpa_users(id) on delete set null,
  edited_at timestamptz default now(),

  -- Alasan edit (wajib kalau ada outside tolerance)
  edit_reason text,

  -- Catatan CM saat return untuk koreksi (diisi oleh CM saat review)
  cm_feedback text,

  -- Status version
  -- 'draft' = PIC RS submit, menunggu CM review
  -- 'returned' = CM return untuk koreksi (PIC RS harus edit lagi)
  -- 'approved' = CM approve, lanjut ke print
  -- 'final' = CM takeover (sudah final, PIC RS hanya print)
  status text not null default 'draft' check (status in ('draft', 'returned', 'approved', 'final')),

  -- CM takeover mode (hanya untuk version_label='final')
  -- null = bukan takeover
  -- 'system_edit' = CM edit di sistem (TipTap)
  -- 'file_upload' = CM upload file Word/PDF
  takeover_mode text check (takeover_mode is null or takeover_mode in ('system_edit', 'file_upload')),

  -- Untuk file_upload mode
  final_file_url text,
  final_file_name text,

  created_at timestamptz default now()
);

create index if not exists idx_wpa_draft_versions_pipeline on wpa_pks_draft_versions(pipeline_id, version);
create index if not exists idx_wpa_draft_versions_status on wpa_pks_draft_versions(status);

-- 2. Tabel wpa_pks_ayat_locks — lock konfigurasi per ayat (dari template)
--    Catatan: ini optional, bisa di-generate on-the-fly dari template
--    Tapi kalau ada, CM bisa set lock per ayat secara custom
create table if not exists wpa_pks_ayat_locks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references wpa_pks_template(id) on delete cascade,
  ayat_identifier text not null,  -- e.g., "pasal_4_ayat_c", "bab_2_pasal_1"
  ayat_label text,  -- human-readable, e.g., "Pasal 4 ayat (c)"
  original_char_count int not null,
  tolerance_pct int default 10,  -- ±10% default
  is_locked boolean default true,  -- true = struktur lock (tidak bisa hapus/tambah ayat)
  lock_reason text,
  created_at timestamptz default now(),
  unique(template_id, ayat_identifier)
);
create index if not exists idx_wpa_ayat_locks_template on wpa_pks_ayat_locks(template_id);

-- 3. Tambah kolom draft_version_id di wpa_pipeline (link ke version terbaru)
alter table wpa_pipeline
  add column if not exists current_draft_version_id uuid references wpa_pks_draft_versions(id) on delete set null;

-- 4. Tambah kolom draft_iteration di wpa_pipeline (track iterasi saat ini: 1-4)
alter table wpa_pipeline
  add column if not exists draft_iteration int default 0;

-- 5. Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- 6. Verifikasi
select column_name, data_type
from information_schema.columns
where table_name = 'wpa_pks_draft_versions'
order by ordinal_position;
