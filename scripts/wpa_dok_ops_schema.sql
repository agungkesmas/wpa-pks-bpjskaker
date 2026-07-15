-- ============================================================
-- DOKUMEN OPERASIONAL — Template Tier 2 (cabang level, editable)
-- ============================================================

-- 1. Template operasional (per cabang, CM/PP/Kabid upload)
create table if not exists wpa_template_operasional (
  id uuid primary key default gen_random_uuid(),
  kantor_cabang_id uuid not null references wpa_kantor_cabang(id) on delete cascade,
  kode text not null,
  nama text not null,
  jenis text not null check (jenis in (
    'sp1', 'sp2', 'sp3',
    'ba_visitasi', 'surat_edaran', 'undangan',
    'surat_pemberitahuan', 'laporan_visitasi', 'ba_negosiasi',
    'lainnya'
  )),
  file_docx_url text,
  file_docx_path text,
  placeholders text[] default '{}',
  is_active boolean default true,
  is_editable boolean default true,
  versi text default '1.0',
  uploaded_by uuid references wpa_users(id) on delete set null,
  is_national boolean default false, -- true = dari super_admin (template nasional)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(kantor_cabang_id, kode)
);
create index if not exists idx_wpa_tpl_ops_cabang on wpa_template_operasional(kantor_cabang_id, is_active);
create index if not exists idx_wpa_tpl_ops_jenis on wpa_template_operasional(jenis, is_active);

-- 2. Dokumen operasional (surat yang di-generate dari template)
do $$ begin
  create type wpa_dok_ops_status as enum ('draft','review_cm','approved','rejected','sent','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wpa_dok_ops_jenis as enum (
    'sp1','sp2','sp3','ba_visitasi','surat_edaran','undangan',
    'surat_pemberitahuan','laporan_visitasi','ba_negosiasi','lainnya'
  );
exception when duplicate_object then null; end $$;

create table if not exists wpa_dokumen_operasional (
  id uuid primary key default gen_random_uuid(),
  template_operasional_id uuid references wpa_template_operasional(id) on delete set null,
  kantor_cabang_id uuid not null references wpa_kantor_cabang(id) on delete cascade,
  faskes_id uuid references wpa_faskes(id) on delete set null,
  pks_id uuid references wpa_pks(id) on delete set null,
  jenis wpa_dok_ops_jenis not null,
  nomor_dokumen text,
  judul text,
  data_jsonb jsonb default '{}'::jsonb,
  file_pdf_url text,
  bukti_urls text[] default '{}',
  
  -- Workflow
  status wpa_dok_ops_status default 'draft',
  drafted_by uuid references wpa_users(id) on delete set null,
  drafted_at timestamptz default now(),
  reviewed_by uuid references wpa_users(id) on delete set null,
  reviewed_at timestamptz,
  review_catatan text,
  approved_by uuid references wpa_users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  sent_to_pic_rs_id uuid references wpa_users(id) on delete set null,
  
  -- Untuk SP: link ke pembinaan
  pembinaan_id uuid, -- link ke wpa_pembinaan (kalau ada)
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_wpa_dok_ops_cabang on wpa_dokumen_operasional(kantor_cabang_id, status);
create index if not exists idx_wpa_dok_ops_faskes on wpa_dokumen_operasional(faskes_id);
create index if not exists idx_wpa_dok_ops_drafted_by on wpa_dokumen_operasional(drafted_by, status);
create index if not exists idx_wpa_dok_ops_jenis on wpa_dokumen_operasional(jenis, status);

-- 3. Log dokumen operasional (audit trail)
create table if not exists wpa_dokumen_operasional_log (
  id uuid primary key default gen_random_uuid(),
  dokumen_id uuid not null references wpa_dokumen_operasional(id) on delete cascade,
  action text not null check (action in ('draft','submit_review','approve','reject','edit','send','archive')),
  performed_by uuid references wpa_users(id) on delete set null,
  performed_at timestamptz default now(),
  catatan text,
  before_data jsonb,
  after_data jsonb
);
create index if not exists idx_wpa_dok_ops_log_dok on wpa_dokumen_operasional_log(dokumen_id, performed_at);

-- 4. Storage bucket
insert into storage.buckets (id, name, public)
values ('wpa-dok-operasional', 'wpa-dok-operasional', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
