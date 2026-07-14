-- WPA PKS BPJS Ketenagakerjaan — Database Schema
-- Target: Supabase project hfhvsiuebrwrqmqzsroc (NEW, isolated project)
-- Convention: prefix wpa_ untuk semua tabel (jaga-jaga walau project baru)
-- Catatan: TIDAK ADA tabel yang dibuat di project ktfyzoowgxvllwauqpir (magang-cerdas-pwa)

-- ============================================================
-- 1. TENANT & APP SETTINGS
-- ============================================================
create table if not exists wpa_kantor_cabang (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  alamat text,
  kota text,
  provinsi text,
  telp text,
  email text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wpa_app_settings (
  id int primary key default 1 check (id = 1),
  allow_self_register_pic_rs boolean default false,
  allow_self_register_legal_rs boolean default false,
  default_pks_duration_months int default 36,
  reminder_months_before int default 3,
  gemini_enabled boolean default true,
  gemini_model text default 'gemini-2.0-flash',
  bot_fallback_rule_based boolean default true,
  multi_tenant_enabled boolean default false,
  default_kantor_cabang_id uuid references wpa_kantor_cabang(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into wpa_app_settings (id) values (1) on conflict do nothing;

-- ============================================================
-- 2. USERS & AUTH
-- ============================================================
create type wpa_user_role as enum ('admin_kantor','case_manager','kepala_bidang','pic_rs','legal_rs');

create table if not exists wpa_users (
  id uuid primary key default gen_random_uuid(),
  kantor_cabang_id uuid references wpa_kantor_cabang(id) on delete set null,
  email text unique not null,
  password_hash text not null,
  full_name text not null,
  role wpa_user_role not null,
  phone text,
  faskes_id uuid, -- untuk pic_rs/legal_rs: faskes yang diasosiasikan
  is_active boolean default true,
  last_login_at timestamptz,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_wpa_users_role on wpa_users(role);
create index idx_wpa_users_kantor on wpa_users(kantor_cabang_id);
create index idx_wpa_users_faskes on wpa_users(faskes_id);

create table if not exists wpa_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references wpa_users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists wpa_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  kantor_cabang_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip text,
  user_agent text,
  created_at timestamptz default now()
);
create index idx_wpa_audit_user on wpa_audit_logs(user_id);
create index idx_wpa_audit_entity on wpa_audit_logs(entity_type, entity_id);

-- ============================================================
-- 3. MASTER FASKES
-- ============================================================
create type wpa_faskes_jenis as enum ('RS','Klinik','Puskesmas','PraktikMandiri','Lainnya');
create type wpa_faskes_status as enum ('draft','pengajuan','kredensialing','negosiasi','aktif','nonaktif','ditolak','berakhir');

create table if not exists wpa_faskes (
  id uuid primary key default gen_random_uuid(),
  kode text unique,
  nama text not null,
  jenis wpa_faskes_jenis not null default 'Klinik',
  bentuk text,
  alamat text,
  kota text,
  provinsi text,
  telp text,
  email text,
  npwp text,
  penanggung_jawab_nama text,
  penanggung_jawab_jabatan text,
  penanggung_jawab_phone text,
  bank_name text,
  bank_cabang text,
  bank_rekening_number text,
  bank_rekening_name text,
  status wpa_faskes_status default 'draft',
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_faskes_status on wpa_faskes(status);
create index idx_wpa_faskes_kantor on wpa_faskes(kantor_cabang_id);

create type wpa_credential_jenis as enum ('SIP','STR','Akta','IzinOperasional','BLU','Lainnya');

create table if not exists wpa_faskes_credentials (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id) on delete cascade,
  jenis wpa_credential_jenis not null,
  nomor text,
  tanggal_terbit date,
  tanggal_berakhir date,
  file_url text,
  verified boolean default false,
  verified_by uuid references wpa_users(id),
  verified_at timestamptz,
  catatan text,
  created_at timestamptz default now()
);
create index idx_wpa_faskes_cred_faskes on wpa_faskes_credentials(faskes_id);

-- ============================================================
-- 4. ONBOARDING FASKES
-- ============================================================
create type wpa_pengajuan_status as enum ('diajukan','ditinjau','kredensialing','layak','tidak_layak','negosiasi','drafting','selesai_drafting','ditandatangani','ditolak');

create table if not exists wpa_faskes_pengajuan (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id) on delete cascade,
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  tanggal_pengajuan date default current_date,
  surat_pengajuan_url text,
  perihal text,
  status wpa_pengajuan_status default 'diajukan',
  assigned_case_manager_id uuid references wpa_users(id),
  assigned_legal_id uuid references wpa_users(id),
  catatan text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_pengajuan_status on wpa_faskes_pengajuan(status);

create type wpa_kredensialing_tahap as enum ('tinjauan_surat','verifikasi_dokumen','visitasi','rekomendasi');
create type wpa_kredensialing_hasil as enum ('pending','memenuhi','tidak_memenuhi','perlu_perbaikan');

create table if not exists wpa_faskes_kredensialing (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid references wpa_faskes_pengajuan(id) on delete cascade,
  tahap wpa_kredensialing_tahap not null,
  tanggal_mulai date default current_date,
  tanggal_selesai date,
  hasil wpa_kredensialing_hasil default 'pending',
  catatan text,
  dokumen_url text,
  performed_by uuid references wpa_users(id),
  created_at timestamptz default now()
);
create index idx_wpa_kred_faskes on wpa_faskes_kredensialing(pengajuan_id);

create table if not exists wpa_faskes_kredensialing_checklist (
  id uuid primary key default gen_random_uuid(),
  kredensialing_id uuid references wpa_faskes_kredensialing(id) on delete cascade,
  item text not null,
  is_done boolean default false,
  catatan text,
  done_by uuid references wpa_users(id),
  done_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- 5. PKS & TEMPLATES
-- ============================================================
create type wpa_pks_jenis as enum ('pks_baru','adendum','perpanjangan');
create type wpa_pks_status as enum ('draft','negosiasi','review_legal','final','ditandatangani','berakhir','diakhiri');

create table if not exists wpa_pks_template (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  version text not null,
  file_docx_url text,
  file_docx_path text,
  placeholders jsonb default '[]'::jsonb,
  pasal_count int default 0,
  lampiran_count int default 0,
  is_active boolean default true,
  uploaded_by uuid references wpa_users(id),
  uploaded_at timestamptz default now()
);
create index idx_wpa_tpl_active on wpa_pks_template(is_active);

create table if not exists wpa_pks_template_placeholder (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references wpa_pks_template(id) on delete cascade,
  key text not null,
  label text,
  tipe text default 'text',
  required boolean default false,
  urutan int default 0,
  kategori text,
  created_at timestamptz default now()
);
create index idx_wpa_tpl_ph_template on wpa_pks_template_placeholder(template_id);

create table if not exists wpa_pks (
  id uuid primary key default gen_random_uuid(),
  kode_pks_pihak_pertama text,
  kode_pks_pihak_kedua text,
  faskes_id uuid references wpa_faskes(id),
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  jenis wpa_pks_jenis default 'pks_baru',
  parent_pks_id uuid references wpa_pks(id),
  template_id uuid references wpa_pks_template(id),
  template_version text,
  status wpa_pks_status default 'draft',
  tanggal_mulai date,
  tanggal_berakhir date,
  tanggal_tanda_tangan date,
  kota_tanda_tangan text,
  data_jsonb jsonb default '{}'::jsonb,
  file_docx_url text,
  file_pdf_url text,
  assigned_case_manager_id uuid references wpa_users(id),
  created_by uuid references wpa_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  signed_at timestamptz
);
create index idx_wpa_pks_faskes on wpa_pks(faskes_id);
create index idx_wpa_pks_status on wpa_pks(status);
create index idx_wpa_pks_kantor on wpa_pks(kantor_cabang_id);
create index idx_wpa_pks_parent on wpa_pks(parent_pks_id);

create table if not exists wpa_pks_versions (
  id uuid primary key default gen_random_uuid(),
  pks_id uuid references wpa_pks(id) on delete cascade,
  versi_int int not null,
  perubahan text,
  snapshot_jsonb jsonb,
  created_by uuid references wpa_users(id),
  created_at timestamptz default now()
);

create table if not exists wpa_pks_signatures (
  id uuid primary key default gen_random_uuid(),
  pks_id uuid references wpa_pks(id) on delete cascade,
  pihak text not null,
  signer_user_id uuid references wpa_users(id),
  signer_name text,
  signer_jabatan text,
  signed_at timestamptz,
  signature_url text,
  ip text,
  user_agent text
);

-- ============================================================
-- 6. ADENDUM (ayat, harga, dropping pusat)
-- ============================================================
create type wpa_adendum_jenis as enum ('ayat','harga','dropping_pusat');
create type wpa_adendum_status as enum ('draft','negosiasi','review_legal','final','ditandatangani','ditolak','kedaluwarsa');

create table if not exists wpa_pks_adendum (
  id uuid primary key default gen_random_uuid(),
  pks_id uuid references wpa_pks(id) on delete cascade,
  jenis wpa_adendum_jenis not null,
  kampanye_dropping_id uuid, -- FK ke wpa_dropping_pusat (di-set kalau jenis='dropping_pusat')
  template_id_new uuid references wpa_pks_template(id),
  perubahan_jsonb jsonb default '{}'::jsonb,
  alasan text,
  status wpa_adendum_status default 'draft',
  tanggal_adendum date default current_date,
  nomor_adendum text,
  deadline_at timestamptz,
  created_by uuid references wpa_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  signed_at timestamptz
);
create index idx_wpa_adendum_pks on wpa_pks_adendum(pks_id);

create table if not exists wpa_pks_adendum_diff (
  id uuid primary key default gen_random_uuid(),
  adendum_id uuid references wpa_pks_adendum(id) on delete cascade,
  ayat_path text,
  before_text text,
  after_text text,
  action text check (action in ('tambah','ubah','hapus'))
);

-- Dropping Pusat (broadcast wajib + deadline)
create type wpa_dropping_jenis as enum ('penambahan_ayat','pengurangan_ayat','perubahan_ayat','perubahan_struktur','ganti_template_total');
create type wpa_dropping_status as enum ('diajukan','aktif','selesai','kedaluwarsa','ditunda');
create type wpa_dropping_target_status as enum ('pending','drafting','review_legal_bpjs','review_legal_rs','final','ditandatangani','ditolak','kedaluwarsa');

create table if not exists wpa_dropping_pusat (
  id uuid primary key default gen_random_uuid(),
  kode_dropping text unique not null,
  judul text not null,
  keterangan text,
  template_lama_id uuid references wpa_pks_template(id),
  template_baru_id uuid references wpa_pks_template(id),
  tanggal_terima_dari_pusat date default current_date,
  deadline_draft date,
  deadline_tanda_tangan date,
  jenis wpa_dropping_jenis default 'perubahan_ayat',
  perubahan_ringkas text,
  status wpa_dropping_status default 'diajukan',
  target_faskes_count int default 0,
  completed_count int default 0,
  created_by uuid references wpa_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  closed_at timestamptz
);

create table if not exists wpa_dropping_pusat_target (
  id uuid primary key default gen_random_uuid(),
  dropping_id uuid references wpa_dropping_pusat(id) on delete cascade,
  pks_id uuid references wpa_pks(id),
  faskes_id uuid references wpa_faskes(id),
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  assigned_case_manager_id uuid references wpa_users(id),
  assigned_legal_id uuid references wpa_users(id),
  status wpa_dropping_target_status default 'pending',
  tanggal_mulai timestamptz,
  tanggal_selesai timestamptz,
  adendum_id uuid references wpa_pks_adendum(id),
  catatan text,
  reminder_count int default 0,
  last_reminder_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(dropping_id, pks_id)
);
create index idx_wpa_dropping_tgt_status on wpa_dropping_pusat_target(status);
create index idx_wpa_dropping_tgt_dropping on wpa_dropping_pusat_target(dropping_id);

create table if not exists wpa_dropping_pusat_progress_log (
  id uuid primary key default gen_random_uuid(),
  dropping_target_id uuid references wpa_dropping_pusat_target(id) on delete cascade,
  action text not null,
  performed_by uuid references wpa_users(id),
  catatan text,
  snapshot_data jsonb,
  created_at timestamptz default now()
);

create table if not exists wpa_dropping_pusat_reminder_log (
  id uuid primary key default gen_random_uuid(),
  dropping_target_id uuid references wpa_dropping_pusat_target(id) on delete cascade,
  jenis text not null,
  channel text,
  sent_at timestamptz default now(),
  sent_to_user_id uuid references wpa_users(id),
  message text
);

-- ============================================================
-- 7. TARIF (Bank data + komparasi kewajaran)
-- ============================================================
create type wpa_tarif_kategori as enum ('kamar','operasi_kecil','operasi_sedang','operasi_besar','laboratorium','radiologi','tindakan_medis','rawat_inap','obat','admin','lainnya');
create type wpa_tarif_sumber as enum ('negosiasi','ina_cbg','rs_pemerintah');

create table if not exists wpa_tarif_bank (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id),
  kategori wpa_tarif_kategori not null,
  nama_item text not null,
  satuan text,
  tarif numeric(14,2) not null,
  tahun int not null default extract(year from current_date),
  sumber wpa_tarif_sumber default 'negosiasi',
  is_active boolean default true,
  created_by uuid references wpa_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_tarif_faskes on wpa_tarif_bank(faskes_id);
create index idx_wpa_tarif_kategori on wpa_tarif_bank(kategori, tahun);

create table if not exists wpa_tarif_kewajaran_rule (
  id uuid primary key default gen_random_uuid(),
  kategori wpa_tarif_kategori unique not null,
  min_percentile_5 numeric(14,2),
  max_percentile_95 numeric(14,2),
  std_dev_threshold numeric(5,2) default 2.0,
  catatan text,
  updated_at timestamptz default now()
);

create type wpa_tarif_kewajaran_status as enum ('wajar','tinggi','rendah','ekstrem');

create table if not exists wpa_tarif_comparison (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id),
  kategori wpa_tarif_kategori,
  item text,
  tarif_diusulkan numeric(14,2),
  tarif_median numeric(14,2),
  tarif_mean numeric(14,2),
  tarif_std_dev numeric(14,2),
  selisih_percent numeric(8,2),
  z_score numeric(8,2),
  status wpa_tarif_kewajaran_status,
  calculated_at timestamptz default now(),
  created_by uuid references wpa_users(id)
);

-- ============================================================
-- 8. REMINDERS & NOTIFICATIONS
-- ============================================================
create type wpa_reminder_jenis as enum ('3_bulan','1_bulan','2_minggu','habis');

create table if not exists wpa_reminders (
  id uuid primary key default gen_random_uuid(),
  pks_id uuid references wpa_pks(id) on delete cascade,
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  tanggal_reminder date not null,
  jenis wpa_reminder_jenis not null,
  status text default 'pending',
  sent_at timestamptz,
  created_at timestamptz default now()
);
create index idx_wpa_reminder_pks on wpa_reminders(pks_id);

create table if not exists wpa_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references wpa_users(id) on delete cascade,
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  type text,
  title text not null,
  body text,
  related_entity text,
  related_id text,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index idx_wpa_notif_user on wpa_notifications(user_id, is_read);

-- ============================================================
-- 9. BOT RESEPSIONIS
-- ============================================================
create table if not exists wpa_bot_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references wpa_users(id) on delete cascade,
  session_token text unique not null,
  konteks_jsonb jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz
);

create table if not exists wpa_bot_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references wpa_bot_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index idx_wpa_bot_msg_session on wpa_bot_messages(session_id, created_at);

-- ============================================================
-- 10. STORAGE BUCKET untuk file PKS/template/dokumen kredensialing
-- ============================================================
insert into storage.buckets (id, name, public)
values ('wpa-pks-docs','wpa-pks-docs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('wpa-credentials','wpa-credentials', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('wpa-templates','wpa-templates', true)
on conflict (id) do nothing;

-- ============================================================
-- 11. SEED DEFAULT KANTOR CABANG + ADMIN
-- ============================================================
insert into wpa_kantor_cabang (id, kode, nama, alamat, kota, provinsi, telp, email, is_active)
values (
  '00000000-0000-0000-0000-000000000001',
  'KC-DEFAULT',
  'BPJS Ketenagakerjaan Cabang Default',
  'Jl. Contoh No. 1',
  'Jakarta',
  'DKI Jakarta',
  '021-00000000',
  'admin@bpjsketenagakerjaan.go.id',
  true
)
on conflict (kode) do nothing;

-- Default admin: email admin@wpa.local / password dari env DEFAULT_ADMIN_PWD
-- Password hash akan di-generate oleh aplikasi saat setup pertama kali.
