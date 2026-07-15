-- ============================================================
-- FASE 3: Template Mandatori (hash per bab + klasifikasi placeholder)
-- ============================================================

-- 1. Tabel template (sudah ada, alter untuk tambah kolom hash)
alter table wpa_pks_template 
  add column if not exists template_hash text,           -- hash keseluruhan
  add column if not exists bab_hashes jsonb default '{}'::jsonb,  -- {bab_id: sha256}
  add column if not exists pasal_count int default 0,
  add column if not exists lampiran_count int default 0,
  add column if not exists is_locked boolean default true,  -- true = tidak bisa diedit
  add column if not exists jenis_dokumen text default 'pks' check (jenis_dokumen in ('pks','adendum_ayat','adendum_harga','sk_mutasi','ba_negosiasi','surat_edaran','sp_pembinaan','other'));

-- 2. Tabel template_bab (struktur bab/pasal/lampiran)
create table if not exists wpa_template_bab (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references wpa_pks_template(id) on delete cascade,
  bab_id text not null,           -- 'cover', 'pasal_1', 'pasal_2', ..., 'lampiran_i', 'pakta'
  bab_label text not null,        -- 'Cover & Identitas', 'Pasal 1: Ketentuan Umum', dll
  bab_type text not null check (bab_type in ('cover','pasal','lampiran','pakta','other')),
  urutan int not null,
  content_text text,              -- teks asli bab (untuk diff nanti)
  content_hash text not null,    -- sha256 dari content_text
  placeholder_keys text[],       -- daftar placeholder di bab ini
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(template_id, bab_id)
);
create index if not exists idx_wpa_template_bab_template on wpa_template_bab(template_id, urutan);

-- 3. Alter wpa_pks_template_placeholder untuk klasifikasi
alter table wpa_pks_template_placeholder 
  add column if not exists bab_id text,                    -- link ke bab
  add column if not exists tipe text default 'manual_required' check (tipe in (
    'auto_faskes',       -- dari wpa_faskes (nama, alamat, npwp, dll)
    'auto_kantor',       -- dari wpa_kantor_cabang
    'auto_user',         -- dari wpa_users (PIC, Kabid, dll)
    'auto_tarif',        -- dari wpa_tarif_faskes
    'auto_kredensial',   -- dari wpa_faskes_credentials
    'manual_required',   -- wajib isi saat drafting
    'manual_optional',   -- boleh kosong
    'calculated'         -- sistem hitung (durasi, total tarif)
  )),
  add column if not exists source_table text,              -- 'wpa_faskes', 'wpa_kantor_cabang'
  add column if not exists source_column text,             -- 'nama', 'alamat'
  add column if not exists default_value text,
  add column if not exists urutan_dalam_bab int default 0,
  add column if not exists keterangan text;

-- 4. Storage bucket untuk template .docx (public read, agar bisa diunduh CM)
insert into storage.buckets (id, name, public)
values ('wpa-templates', 'wpa-templates', true)
on conflict (id) do nothing;

-- 5. Mapping placeholder ke source (auto-fill logic)
-- Format: key → (source_table, source_column)
-- Sistem auto-detect berdasarkan nama placeholder saat upload
create or replace function wpa_klasifikasi_placeholder(p_key text) returns table(
  tipe text,
  source_table text,
  source_column text
) as $$
declare
  v_key_lower text := lower(p_key);
begin
  -- Auto-faskes
  if v_key_lower like 'nama_faskes%' then
    return query select 'auto_faskes'::text, 'wpa_faskes'::text, 'nama'::text;
  elsif v_key_lower like 'alamat_faskes%' then
    return query select 'auto_faskes'::text, 'wpa_faskes'::text, 'alamat'::text;
  elsif v_key_lower like 'npwp_faskes%' or v_key_lower = 'npwp' then
    return query select 'auto_faskes'::text, 'wpa_faskes'::text, 'npwp'::text;
  elsif v_key_lower like 'telp_faskes%' then
    return query select 'auto_faskes'::text, 'wpa_faskes'::text, 'telp'::text;
  elsif v_key_lower like 'email_faskes%' then
    return query select 'auto_faskes'::text, 'wpa_faskes'::text, 'email'::text;
  elsif v_key_lower like 'penanggung_jawab%' then
    return query select 'auto_faskes'::text, 'wpa_faskes'::text, 'penanggung_jawab_nama'::text;
  elsif v_key_lower like 'bank_%' then
    return query select 'auto_faskes'::text, 'wpa_faskes'::text, p_key_lower::text;
  -- Auto-kantor cabang
  elsif v_key_lower like 'nama_kantor_cabang%' then
    return query select 'auto_kantor'::text, 'wpa_kantor_cabang'::text, 'nama'::text;
  elsif v_key_lower like 'alamat_kantor_cabang%' then
    return query select 'auto_kantor'::text, 'wpa_kantor_cabang'::text, 'alamat'::text;
  elsif v_key_lower like 'telp_fax_bpjs%' or v_key_lower like 'telp_kantor%' then
    return query select 'auto_kantor'::text, 'wpa_kantor_cabang'::text, 'telp'::text;
  -- Auto-user (PIC, Kabid, CM)
  elsif v_key_lower like 'pic_bpjs%' or v_key_lower like 'nama_pic_bpjs%' then
    return query select 'auto_user'::text, 'wpa_users'::text, 'full_name'::text;
  elsif v_key_lower like 'hp_pic_bpjs%' then
    return query select 'auto_user'::text, 'wpa_users'::text, 'phone'::text;
  elsif v_key_lower like 'email_pic_bpjs%' then
    return query select 'auto_user'::text, 'wpa_users'::text, 'email'::text;
  elsif v_key_lower like 'jabatan_pic_bpjs%' then
    return query select 'auto_user'::text, 'wpa_users'::text, 'role'::text;
  elsif v_key_lower like 'nama_kepala_kantor%' then
    return query select 'auto_user'::text, 'wpa_users'::text, 'full_name'::text;
  -- Manual required (nomor PKS, tanggal, dll)
  elsif v_key_lower like 'nomor_pks%' or v_key_lower like 'nomor_ba%' or 
        v_key_lower like 'nomor_sk%' or v_key_lower like 'nomor_kep%' or
        v_key_lower like 'nomor_surat%' or v_key_lower like 'nomor_informasi%' or
        v_key_lower like 'tanggal%' or v_key_lower like 'hari_%' or 
        v_key_lower like 'bulan%' or v_key_lower like 'tahun%' or
        v_key_lower like 'kota%' or v_key_lower like 'deadline%' or
        v_key_lower like 'jenis_tarif%' or v_key_lower like 'kelas_rawat%' or
        v_key_lower like 'bentuk_faskes%' or v_key_lower like 'jenis_faskes%' or
        v_key_lower like 'jenis_akta%' or v_key_lower like 'dasar_kewenangan%' or
        v_key_lower like 'judul_kep%' or v_key_lower like 'perihal%' or
        v_key_lower like 'acuan_tarif%' or v_key_lower like 'nama_rs_pemerintah%' then
    return query select 'manual_required'::text, null::text, null::text;
  -- Manual optional
  elsif v_key_lower like 'catatan%' or v_key_lower like 'keterangan%' then
    return query select 'manual_optional'::text, null::text, null::text;
  else
    return query select 'manual_required'::text, null::text, null::text;
  end if;
end;
$$ language plpgsql immutable;

notify pgrst, 'reload schema';
