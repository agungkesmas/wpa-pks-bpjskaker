-- ============================================================
-- FASE 2: PIC RS Pengajuan + Pipeline Tracking + Access Control
-- ============================================================

-- 1. Tambah kolom takeover_enabled ke wpa_pipeline
-- Default false = PP TIDAK bisa ambil alih, hanya CM/Kabid yang bisa handle
-- True = CM/Kabid buka akses untuk PP (karena CM berhalangan, dll)
alter table wpa_pipeline 
  add column if not exists takeover_enabled boolean default false,
  add column if not exists takeover_enabled_by uuid references wpa_users(id) on delete set null,
  add column if not exists takeover_enabled_at timestamptz,
  add column if not exists takeover_reason text;

-- 2. Tabel access control log (siapa yang buka/tutup akses PP, kapan, kenapa)
create table if not exists wpa_pipeline_access_control (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references wpa_pipeline(id) on delete cascade,
  action text not null check (action in ('enabled_takeover','disabled_takeover','taken_over')),
  performed_by uuid not null references wpa_users(id) on delete set null,
  performed_at timestamptz default now(),
  reason text
);
create index if not exists idx_wpa_pipeline_acl_pipeline on wpa_pipeline_access_control(pipeline_id, performed_at);

-- 3. Tabel dokumen pengajuan (file upload dari PIC RS)
do $$ begin
  create type wpa_dokumen_pengajuan_jenis as enum (
    'surat_pengajuan', 'akta_pendirian', 'izin_operasional', 'npwp',
    'sip_dokter', 'str_dokter', 'sk_pj', 'daftar_tenaga_medis',
    'surat_kuasa', 'lainnya'
  );
exception when duplicate_object then null; end $$;

create table if not exists wpa_pengajuan_dokumen (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references wpa_pipeline(id) on delete cascade,
  faskes_id uuid references wpa_faskes(id) on delete cascade,
  jenis wpa_dokumen_pengajuan_jenis not null,
  file_name text not null,
  file_url text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references wpa_users(id) on delete set null,
  uploaded_at timestamptz default now(),
  verified boolean default false,
  verified_by uuid references wpa_users(id) on delete set null,
  verified_at timestamptz,
  catatan text
);
create index if not exists idx_wpa_pengajuan_dokumen_pipeline on wpa_pengajuan_dokumen(pipeline_id);
create index if not exists idx_wpa_pengajuan_dokumen_faskes on wpa_pengajuan_dokumen(faskes_id);

-- 4. Tabel kredensialing checklist (untuk tahap kredensialing)
create table if not exists wpa_kredensialing_checklist (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references wpa_pipeline(id) on delete cascade,
  item text not null,
  is_required boolean default true,
  is_done boolean default false,
  done_by uuid references wpa_users(id) on delete set null,
  done_at timestamptz,
  catatan text,
  file_url text,
  urutan int default 0,
  unique(pipeline_id, item)
);

-- 5. Tabel chat/negosiasi (untuk tahap negosiasi tarif)
create table if not exists wpa_pipeline_chat (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references wpa_pipeline(id) on delete cascade,
  sender_id uuid not null references wpa_users(id) on delete set null,
  sender_role wpa_user_role,
  message text not null,
  message_type text default 'text' check (message_type in ('text','file','system','tarif_proposal')),
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_wpa_pipeline_chat_pipeline on wpa_pipeline_chat(pipeline_id, created_at);

-- 6. Notifikasi seed untuk existing users (default ON)
insert into wpa_notifications (user_id, type, title, body, related_entity, related_id)
select 
  id, 
  'system_welcome',
  'Selamat Datang di Manajemen PLKK',
  'Akun Anda siap digunakan. Mulai dari Dashboard untuk melihat tugas & aktivitas.',
  null,
  null
from wpa_users 
where is_active = true
on conflict do nothing;

-- 7. Reload schema
notify pgrst, 'reload schema';
