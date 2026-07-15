-- ============================================================
-- MANAJEMEN PLKK — Schema Final (6 Role, Pipeline Universal)
-- ============================================================
-- 6 Role: super_admin, kepala_bidang, case_manager, penata_pelayanan, pic_rs, legal_rs
-- Hapus: admin_kantor, legal_bpjs (tidak diperlukan di cabang)
-- ============================================================

-- 1. Drop enum lama & buat enum baru
--    Karena enum lama sudah di-drop di run sebelumnya, kita coba create if not exists
do $$ begin
  create type wpa_user_role as enum (
    'super_admin',
    'kepala_bidang',
    'case_manager',
    'penata_pelayanan',
    'pic_rs',
    'legal_rs'
  );
exception when duplicate_object then null; end $$;

-- 2. Alter wpa_users: kolom role sudah jadi enum baru (dari run sebelumnya)
--    Skip update role lama karena enum sudah tidak punya value lama

-- 3. Tabel pipeline universal (anti-tumbang by design)
create table if not exists wpa_pipeline (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('faskes_baru','pks_baru','adendum_harga','adendum_dropping','perpanjangan','perubahan_data')),
  reference_id uuid, -- ID ke wpa_faskes_pengajuan / wpa_pks / wpa_pks_adendum / dll
  reference_type text, -- 'faskes_pengajuan', 'pks', 'adendum'
  kantor_cabang_id uuid references wpa_kantor_cabang(id) on delete set null,
  faskes_id uuid references wpa_faskes(id) on delete set null,
  pks_id uuid references wpa_pks(id) on delete set null,
  
  -- Current state
  current_tahap text not null default 'diajukan',
  current_handler_id uuid references wpa_users(id) on delete set null,
  handler_since timestamptz,
  cabang_owned boolean default true, -- tugas milik cabang, bukan individu
  
  -- SLA tracking
  sla_deadline timestamptz,
  sla_breached boolean default false,
  
  -- Status
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled','rejected','expired','stalled')),
  
  -- Metadata
  initiated_by uuid references wpa_users(id) on delete set null,
  initiated_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_wpa_pipeline_cabang on wpa_pipeline(kantor_cabang_id, status);
create index if not exists idx_wpa_pipeline_handler on wpa_pipeline(current_handler_id);
create index if not exists idx_wpa_pipeline_jenis on wpa_pipeline(jenis, status);

-- 4. Log transisi tahap (immutable audit trail)
create table if not exists wpa_pipeline_log (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references wpa_pipeline(id) on delete cascade,
  tahap text not null,
  action text not null check (action in ('enter','submit','approve','reject','return','takeover','skip','complete','cancel')),
  from_tahap text,
  to_tahap text,
  performed_by uuid references wpa_users(id) on delete set null,
  performed_at timestamptz default now(),
  catatan text,
  sla_actual_hours numeric,
  metadata jsonb
);
create index if not exists idx_wpa_pipeline_log_pipeline on wpa_pipeline_log(pipeline_id, performed_at);

-- 5. Takeover log (anti-tumbang: siapa ambil alih kapan)
create table if not exists wpa_pipeline_takeover_log (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references wpa_pipeline(id) on delete cascade,
  from_user_id uuid references wpa_users(id) on delete set null,
  to_user_id uuid not null references wpa_users(id) on delete set null,
  taken_at timestamptz default now(),
  reason text
);

-- 6. Tahap konfigurasi per jenis pipeline (conditional tahap)
create table if not exists wpa_pipeline_tahap_config (
  id uuid primary key default gen_random_uuid(),
  jenis_pipeline text not null,
  tahap text not null,
  urutan int not null,
  is_wajib boolean default true, -- false = conditional (bisa skip)
  default_sla_days int default 7,
  handler_role wpa_user_role, -- role yang berhak handle tahap ini
  description text,
  unique(jenis_pipeline, tahap)
);

-- Seed tahap config (8 tahap universal + conditional)
insert into wpa_pipeline_tahap_config (jenis_pipeline, tahap, urutan, is_wajib, default_sla_days, handler_role, description) values
  -- PKS BARU (8 tahap lengkap)
  ('pks_baru', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS submit form pengajuan'),
  ('pks_baru', 'ditinjau', 2, true, 2, 'case_manager', 'CM review kelengkapan dokumen'),
  ('pks_baru', 'kredensialing', 3, true, 7, 'case_manager', 'Verifikasi dokumen + visitasi'),
  ('pks_baru', 'negosiasi_tarif', 4, true, 7, 'case_manager', 'Negosiasi tarif vs Bank Tarif acuan'),
  ('pks_baru', 'drafting_pks', 5, true, 7, 'case_manager', 'Auto-create draft dari template + data'),
  ('pks_baru', 'approval_kabid', 6, true, 2, 'kepala_bidang', 'Approval Kabid (4-Eyes)'),
  ('pks_baru', 'review_legal_rs', 7, true, 5, 'legal_rs', 'Review legal RS'),
  ('pks_baru', 'tanda_tangan', 8, true, 3, 'kepala_bidang', 'Tanda tangan elektronik'),
  
  -- PERPANJANGAN (negosiasi_tarif conditional, skip kredensialing)
  ('perpanjangan', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS/CM ajukan perpanjangan'),
  ('perpanjangan', 'ditinjau', 2, true, 2, 'case_manager', 'CM review data'),
  ('perpanjangan', 'negosiasi_tarif', 3, false, 7, 'case_manager', 'Conditional: skip jika tarif sama & wajar'),
  ('perpanjangan', 'drafting_pks', 4, true, 5, 'case_manager', 'Auto-clone dari PKS lama'),
  ('perpanjangan', 'approval_kabid', 5, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('perpanjangan', 'review_legal_rs', 6, true, 5, 'legal_rs', 'Review legal RS'),
  ('perpanjangan', 'tanda_tangan', 7, true, 3, 'kepala_bidang', 'Tanda tangan'),
  
  -- ADENDUM HARGA (skip kredensialing, wajib negosiasi tarif)
  ('adendum_harga', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS ajukan perubahan tarif'),
  ('adendum_harga', 'ditinjau', 2, true, 2, 'case_manager', 'CM review proposal'),
  ('adendum_harga', 'negosiasi_tarif', 3, true, 7, 'case_manager', 'Negosiasi tarif baru'),
  ('adendum_harga', 'drafting_adendum', 4, true, 5, 'case_manager', 'Draft adendum dari template'),
  ('adendum_harga', 'approval_kabid', 5, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('adendum_harga', 'review_legal_rs', 6, true, 5, 'legal_rs', 'Review legal RS'),
  ('adendum_harga', 'tanda_tangan', 7, true, 3, 'kepala_bidang', 'Tanda tangan'),
  
  -- ADENDUM DROPPING PUSAT (skip kredensialing & negosiasi tarif)
  ('adendum_dropping', 'drafting_adendum', 1, true, 14, 'case_manager', 'Auto-assign, drafting per target'),
  ('adendum_dropping', 'approval_kabid', 2, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('adendum_dropping', 'review_legal_rs', 3, true, 5, 'legal_rs', 'Review legal RS'),
  ('adendum_dropping', 'tanda_tangan', 4, true, 3, 'kepala_bidang', 'Tanda tangan'),
  
  -- PERUBAHAN DATA FASKES (skip kredensialing & negosiasi tarif)
  ('perubahan_data', 'diajukan', 1, true, 1, 'pic_rs', 'PIC RS ajukan perubahan data'),
  ('perubahan_data', 'ditinjau', 2, true, 2, 'case_manager', 'CM review'),
  ('perubahan_data', 'drafting_adendum', 3, true, 3, 'case_manager', 'Draft adendum perubahan data'),
  ('perubahan_data', 'approval_kabid', 4, true, 2, 'kepala_bidang', 'Approval Kabid'),
  ('perubahan_data', 'review_legal_rs', 5, true, 5, 'legal_rs', 'Review legal RS'),
  ('perubahan_data', 'tanda_tangan', 6, true, 3, 'kepala_bidang', 'Tanda tangan')
on conflict (jenis_pipeline, tahap) do nothing;

-- 7. Update wpa_users: tambah kolom untuk PIC RS temporary (belum ada faskes)
alter table wpa_users 
  add column if not exists is_temporary boolean default false,
  add column if not exists temporary_for_pipeline_id uuid;

-- 8. Update wpa_app_settings: tambah SLA config global
alter table wpa_app_settings 
  add column if not exists auto_assign_enabled boolean default true,
  add column if not exists max_active_per_cm int default 5,
  add column if not exists allow_self_register_pic_rs boolean default false;

-- 9. Storage bucket untuk dokumen pendukung pengajuan
insert into storage.buckets (id, name, public) 
values ('wpa-pengajuan-docs', 'wpa-pengajuan-docs', false)
on conflict (id) do nothing;

-- 10. Reload PostgREST schema cache
notify pgrst, 'reload schema';
