-- ============================================================
-- PRIORITAS 1: Schema update untuk Kantor Cabang + User Management v2
-- ============================================================

-- 1. Tambah role super_admin ke enum
do $$ begin
  alter type wpa_user_role add value 'super_admin' before 'admin_kantor';
exception when duplicate_object then null; end $$;

-- 2. Tabel grup faskes (PKS Payung)
create table if not exists wpa_faskes_group (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  jenis text default 'RS Group',
  alamat text,
  kota text,
  provinsi text,
  telp text,
  email text,
  npwp text,
  penanggung_jawab_nama text,
  penanggung_jawab_jabatan text,
  penanggung_jawab_phone text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Alter wpa_faskes: tambah group_id + tipe
alter table wpa_faskes 
  add column if not exists group_id uuid references wpa_faskes_group(id) on delete set null,
  add column if not exists tipe text check (tipe in ('A','B','C','D','Umum','-')) default '-';

-- 4. Junction: 1 PIC bisa multi-faskes
create table if not exists wpa_user_faskes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references wpa_users(id) on delete cascade,
  faskes_id uuid not null references wpa_faskes(id) on delete cascade,
  is_primary boolean default false,
  created_at timestamptz default now(),
  unique(user_id, faskes_id)
);
create index if not exists idx_wpa_user_faskes_user on wpa_user_faskes(user_id);
create index if not exists idx_wpa_user_faskes_faskes on wpa_user_faskes(faskes_id);

-- 5. Migrate existing wpa_users.faskes_id ke wpa_user_faskes
insert into wpa_user_faskes (user_id, faskes_id, is_primary)
select id, faskes_id, true from wpa_users where faskes_id is not null
on conflict (user_id, faskes_id) do nothing;

-- 6. Alter wpa_users: tambah profile fields
alter table wpa_users
  add column if not exists profile_photo_url text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists nip text,
  add column if not exists temp_password text,
  add column if not exists temp_password_expires_at timestamptz,
  add column if not exists must_change_password boolean default false;

-- 7. Tabel mutasi user antar cabang
do $$ begin
  create type wpa_mutasi_status as enum ('pending','active','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists wpa_user_mutasi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references wpa_users(id) on delete cascade,
  from_kantor_cabang_id uuid references wpa_kantor_cabang(id) on delete set null,
  to_kantor_cabang_id uuid not null references wpa_kantor_cabang(id) on delete cascade,
  tanggal_sk date not null default current_date,
  tanggal_efektif date not null,
  nomor_sk text,
  file_sk_url text,
  alasan text,
  status wpa_mutasi_status default 'pending',
  processed_at timestamptz,
  created_by uuid references wpa_users(id) on delete set null,
  created_at timestamptz default now(),
  approved_by uuid references wpa_users(id) on delete set null,
  approved_at timestamptz
);
create index if not exists idx_wpa_mutasi_user on wpa_user_mutasi(user_id);
create index if not exists idx_wpa_mutasi_status on wpa_user_mutasi(status, tanggal_efektif);

-- 8. Alter wpa_pks: tambah is_payung + parent_pks_payung_id
alter table wpa_pks
  add column if not exists is_payung boolean default false,
  add column if not exists parent_pks_payung_id uuid references wpa_pks(id) on delete set null;

-- 9. Storage bucket untuk profile photos
insert into storage.buckets (id, name, public) 
values ('wpa-profile-photos', 'wpa-profile-photos', true)
on conflict (id) do nothing;

-- 10. Super admin seed akan dilakukan via script terpisah (karena enum value baru harus di-commit dulu)

-- 11. Reload PostgREST schema cache
notify pgrst, 'reload schema';
