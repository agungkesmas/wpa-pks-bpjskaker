# 04 — Database Schema (Consolidated)

> Sumber: gabungan dari 17 file SQL di `/home/z/my-project/scripts/*.sql`
> Target DB: Supabase project `hfhvsiuebrwrqmqzsroc`
> Convention: prefix `wpa_` untuk semua tabel

## Tabel Utama

### 1. `wpa_kantor_cabang`
Cabang BPJS Ketenagakerjaan (multi-tenant).

```sql
create table wpa_kantor_cabang (
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
```

### 2. `wpa_app_settings`
Singleton (id=1). Setting global aplikasi.

```sql
create table wpa_app_settings (
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
```

### 3. `wpa_users`
User dengan role-based access.

```sql
-- Enum: tambah super_admin & penata_pelayanan via ALTER TYPE
create type wpa_user_role as enum (
  'admin_kantor',      -- DEPRECATED, jangan pakai
  'case_manager',
  'kepala_bidang',
  'pic_rs',
  'legal_rs',
  'super_admin',       -- ditambah via ALTER TYPE
  'penata_pelayanan'   -- ditambah via ALTER TYPE
);

create table wpa_users (
  id uuid primary key default gen_random_uuid(),
  kantor_cabang_id uuid references wpa_kantor_cabang(id) on delete set null,
  email text unique not null,
  password_hash text not null,
  full_name text not null,
  role wpa_user_role not null,
  phone text,
  faskes_id uuid,                       -- untuk pic_rs/legal_rs
  is_active boolean default true,
  can_submit_pks_baru boolean default false,  -- flag untuk PIC RS yang boleh submit
  last_login_at timestamptz,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_users_role on wpa_users(role);
create index idx_wpa_users_kantor on wpa_users(kantor_cabang_id);
create index idx_wpa_users_faskes on wpa_users(faskes_id);
```

### 4. `wpa_password_resets`
Token reset password (TTL 1 jam).

```sql
create table wpa_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references wpa_users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);
```

### 5. `wpa_audit_logs`
Audit trail semua aksi.

```sql
create table wpa_audit_logs (
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
```

### 6. `wpa_faskes`
Master fasilitas kesehatan (RS/Klinik).

```sql
create type wpa_faskes_jenis as enum ('RS','Klinik','Puskesmas','PraktikMandiri','Lainnya');
create type wpa_faskes_status as enum (
  'draft','pengajuan','kredensialing','negosiasi',
  'aktif','nonaktif','ditolak','berakhir'
);

create table wpa_faskes (
  id uuid primary key default gen_random_uuid(),
  kode text unique,
  nama text not null,
  jenis wpa_faskes_jenis not null default 'Klinik',
  alamat text,
  kota text,
  provinsi text,
  telp text,
  email text,
  npwp text,
  penanggung_jawab text,
  jabatan_pj text,
  nama_bank text,
  cabang_bank text,
  nomor_rekening text,
  nama_rekening text,
  status wpa_faskes_status default 'draft',
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  data_jsonb jsonb default '{}'::jsonb,  -- placeholder values (81 field)
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_faskes_kantor on wpa_faskes(kantor_cabang_id);
create index idx_wpa_faskes_status on wpa_faskes(status);
```

### 7. `wpa_pks`
PKS final (setelah TTD).

```sql
create table wpa_pks (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id) on delete cascade,
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  nomor_pks_pihak_pertama text,    -- nomor BPJS
  nomor_pks_pihak_kedua text,      -- nomor faskes
  tanggal_mulai date not null,
  tanggal_akhir date not null,
  jenis text not null,             -- pks_baru, perpanjangan, adendum_*
  status text default 'aktif',     -- aktif, berakhir, nonaktif
  data_jsonb jsonb default '{}'::jsonb,
  file_docx_path text,             -- [BEFORE] Supabase Storage path
  file_docx_hash text,             -- SHA-256 (untuk detect perubahan)
  google_doc_id text,              -- [AFTER MIGRATION]
  google_doc_url text,             -- [AFTER MIGRATION]
  signed_pdf_path text,            -- PDF hasil scan TTD basah
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_pks_faskes on wpa_pks(faskes_id);
create index idx_wpa_pks_status on wpa_pks(status);
create index idx_wpa_pks_jenis on wpa_pks(jenis);
```

### 8. `wpa_pks_template`
Template dokumen PKS per jenis pengajuan.

```sql
create table wpa_pks_template (
  id uuid primary key default gen_random_uuid(),
  jenis_pipeline text not null,
  nama text not null,
  version int default 1,
  file_docx_path text,             -- [BEFORE] Supabase Storage path
  google_doc_template_id text,     -- [AFTER MIGRATION] Google Docs template ID
  placeholders jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_by uuid references wpa_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_pks_template_jenis on wpa_pks_template(jenis_pipeline);
```

### 9. `wpa_pks_template_placeholder`
Detail placeholder per template (untuk form UI).

```sql
create table wpa_pks_template_placeholder (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references wpa_pks_template(id) on delete cascade,
  key text not null,              -- mis. NAMA_FASKES
  label text not null,
  tipe text default 'text',      -- text, date, number, textarea, select
  kategori text,
  bab_id text,
  is_wajib boolean default true,
  options jsonb,                  -- untuk tipe=select
  urutan int default 0,
  unique(template_id, key)
);
```

### 10. `wpa_pipeline`
Pipeline state machine (satu record per pengajuan).

```sql
create table wpa_pipeline (
  id uuid primary key default gen_random_uuid(),
  jenis_pipeline text not null,
  faskes_id uuid references wpa_faskes(id) on delete cascade,
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  current_tahap text not null default 'diajukan',
  status text default 'in_progress',  -- in_progress, cancelled, completed
  initiated_by uuid references wpa_users(id),
  template_id uuid references wpa_pks_template(id),
  pks_id uuid references wpa_pks(id), -- hasil final setelah tanda_tangan
  data_jsonb jsonb default '{}'::jsonb,
  -- [BEFORE] html_content disimpan di sini juga
  -- [AFTER MIGRATION] ganti dengan:
  google_doc_id text,
  google_doc_url text,
  google_doc_shared_with jsonb default '[]'::jsonb,
  -- Adendum masal specific
  pdf_generated_url text,
  -- Takeover tracking
  takeover_status text,          -- null, 'pp_ambil_alih', 'cm_takeover'
  takeover_by uuid references wpa_users(id),
  takeover_at timestamptz,
  -- Cancel/complete
  cancelled_at timestamptz,
  cancelled_by uuid references wpa_users(id),
  cancel_reason text,
  completed_at timestamptz,
  -- Adendum masal group-action
  group_action_id uuid,
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_pipeline_jenis on wpa_pipeline(jenis_pipeline);
create index idx_wpa_pipeline_faskes on wpa_pipeline(faskes_id);
create index idx_wpa_pipeline_kantor on wpa_pipeline(kantor_cabang_id);
create index idx_wpa_pipeline_status on wpa_pipeline(status);
create index idx_wpa_pipeline_tahap on wpa_pipeline(current_tahap);
create index idx_wpa_pipeline_initiated on wpa_pipeline(initiated_by);
```

### 11. `wpa_pks_draft_versions`
Version tracking untuk drafting (max 4 versions: 1, 2, 3, 4 dengan v4 = CM takeover).

```sql
create table wpa_pks_draft_versions (
  id uuid primary key default gen_random_uuid(),
  pks_id uuid references wpa_pks(id) on delete cascade,
  pipeline_id uuid references wpa_pipeline(id) on delete cascade,
  version int not null,            -- 1, 2, 3, 4
  -- [BEFORE] HTML content dari mammoth
  content_html text,
  -- [AFTER MIGRATION] ganti dengan:
  google_doc_version_id text,      -- Google Docs revision ID
  -- CM review
  catatan_cm text,
  review_status text default 'pending',  -- pending, approved, returned, taken_over
  submitted_by uuid references wpa_users(id),
  submitted_at timestamptz default now(),
  reviewed_by uuid references wpa_users(id),
  reviewed_at timestamptz,
  -- Char count tracking (untuk detect perubahan signifikan)
  char_count_baseline int,
  char_count_submitted int,
  created_at timestamptz default now(),
  unique(pks_id, version)
);
create index idx_wpa_draft_versions_pks on wpa_pks_draft_versions(pks_id);
create index idx_wpa_draft_versions_pipeline on wpa_pks_draft_versions(pipeline_id);
```

### 12. `wpa_tahap_config`
Konfigurasi tahap per jenis pipeline (urutan, SLA, handler).

```sql
create table wpa_tahap_config (
  id uuid primary key default gen_random_uuid(),
  jenis_pipeline text not null,
  tahap text not null,
  urutan int not null,
  is_wajib boolean default true,
  default_sla_days int default 1,
  handler_role text not null,
  description text,
  unique(jenis_pipeline, tahap)
);
-- Seed data lihat wpa-constants.ts:TAHAP_CONFIG_SEED
```

### 13. `wpa_dokumen_pengajuan`
File wajib yang di-upload PIC RS (akta, izin, NPWP, dll).

```sql
create type wpa_dokumen_pengajuan_jenis as enum (
  'surat_pengantar_kerjasama',
  'company_profile',
  'tarif_diajukan',
  'akta_pendirian',
  'izin_operasional',
  'npwp',
  'sk_pj',
  'surat_permohonan_perpanjangan',
  'surat_pengantar_adendum',
  'lampiran_adendum',
  'surat_pengajuan',
  'sip_dokter',
  'str_dokter',
  'daftar_tenaga_medis',
  'surat_kuasa',
  'lainnya'
);

create table wpa_dokumen_pengajuan (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references wpa_pipeline(id) on delete cascade,
  jenis wpa_dokumen_pengajuan_jenis not null,
  label text,
  file_path text not null,         -- Supabase Storage path
  file_size bigint,
  mime_type text,
  uploaded_by uuid references wpa_users(id),
  uploaded_at timestamptz default now()
);
create index idx_wpa_dokumen_pengajuan_pipeline on wpa_dokumen_pengajuan(pipeline_id);
```

### 14. `wpa_tarif_acuan`
Tarif acuan (baku provinsi atau rata-rata daerah).

```sql
create table wpa_tarif_acuan (
  id uuid primary key default gen_random_uuid(),
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  kode_item text not null,         -- mis. ICU01, OK01
  nama_item text not null,
  kategori text,                   -- layanan rawat inap, rawat jalan, dll
  mode text not null,              -- 'provinsi_ceiling' | 'rata_rata_daerah'
  tarif_ceiling bigint,            -- untuk mode=provinsi_ceiling
  tarif_rata_rata bigint,          -- untuk mode=rata_rata_daerah
  tarif_min bigint,
  tarif_max bigint,
  rs_acuan jsonb,                  -- array RS yang dijadikan acuan rata-rata
  tahun_berlaku int,
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_wpa_tarif_acuan_kantor on wpa_tarif_acuan(kantor_cabang_id);
create index idx_wpa_tarif_acuan_kode on wpa_tarif_acuan(kode_item);
```

### 15. `wpa_tarif_standar`
75+ item tarif baku kecelakaan kerja (diisi via batch import).

```sql
create table wpa_tarif_standar (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  kategori text not null,          -- Rawat Inap, Rawat Jalan, Penunjang, OK, ICU, dll
  sub_kategori text,
  default_tarif bigint,
  ceiling_provinsi bigint,
  satuan text default 'per layanan',
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### 16. `wpa_tarif_faskes`
Tarif yang diajukan/diterima per faskes.

```sql
create table wpa_tarif_faskes (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id) on delete cascade,
  pipeline_id uuid references wpa_pipeline(id) on delete set null,
  kode_item text not null,
  nama_item text not null,
  tarif_diajukan bigint,
  tarif_disetujui bigint,
  status text default 'diajukan',  -- diajukan, disetujui, ditolak, review
  keterangan text,
  uploaded_at timestamptz default now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);
create index idx_wpa_tarif_faskes_faskes on wpa_tarif_faskes(faskes_id);
```

### 17. `wpa_ai_api_keys`
Multi-provider AI keys dengan auto-rotate.

```sql
create table wpa_ai_api_keys (
  id uuid primary key default gen_random_uuid(),
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  provider text not null,          -- gemini, openai, zhipu, deepseek, qwen, claude
  api_key text not null,
  base_url text,
  model text,
  is_active boolean default true,
  is_default boolean default false,
  quota_exhausted boolean default false,
  quota_reset_at timestamptz,
  last_used_at timestamptz,
  last_error text,
  error_count int default 0,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 18. `wpa_ai_tarif_review`
Log AI second opinion untuk kajian tarif.

```sql
create table wpa_ai_tarif_review (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references wpa_pipeline(id) on delete cascade,
  provider text not null,
  key_id uuid references wpa_ai_api_keys(id),
  prompt text,
  response text,
  model text,
  tokens_used int,
  duration_ms int,
  created_at timestamptz default now()
);
```

### 19. `wpa_adendum_masal_template`
Template adendum masal (dipublish oleh Super Admin / Kantor Pusat).

```sql
create table wpa_adendum_masal_template (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  description text,
  template_docx_path text,
  google_doc_template_id text,     -- [AFTER MIGRATION]
  placeholders jsonb default '[]'::jsonb,
  is_active boolean default true,
  published_by uuid,
  published_at timestamptz default now(),
  deadline timestamptz
);
```

### 20. `wpa_pipeline_placeholder_values`
Nilai placeholder yang PIC RS isi untuk adendum masal.

```sql
create table wpa_pipeline_placeholder_values (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references wpa_pipeline(id) on delete cascade,
  template_id uuid references wpa_adendum_masal_template(id),
  values_jsonb jsonb default '{}'::jsonb,
  submitted_by uuid,
  submitted_at timestamptz default now(),
  group_action_id uuid,            -- null = belum di-group-action
  group_action_status text,        -- null, 'approved', 'rejected'
  group_action_at timestamptz,
  group_action_by uuid
);
```

### 21. `wpa_dropping_pusat`
Dropping pusat (hapus faskes dari daftar PLKK cabang).

```sql
create table wpa_dropping_pusat (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id),
  kantor_cabang_asal uuid references wpa_kantor_cabang(id),
  kantor_cabang_tujuan uuid references wpa_kantor_cabang(id),  -- null = drop total
  alasan text,
  pipeline_id uuid references wpa_pipeline(id),
  initiated_by uuid,
  initiated_at timestamptz default now(),
  effective_date date
);
```

### 22. `wpa_dokumen_operasional`
Surat menyurat post-PKS (SP, BA visitasi, sosialisasi, dll).

```sql
create table wpa_dokumen_operasional (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id) on delete cascade,
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  jenis text not null,             -- surat_peringatan, ba_visitasi, sosialisasi, dll
  nomor text,
  perihal text,
  tanggal date,
  file_path text,
  content_html text,               -- [BEFORE] jika dibuat via TipTap
  google_doc_id text,              -- [AFTER MIGRATION]
  google_doc_url text,             -- [AFTER MIGRATION]
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 23. `wpa_notification`
In-app notification.

```sql
create table wpa_notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references wpa_users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index idx_wpa_notification_user on wpa_notification(user_id, is_read);
```

### 24. `wpa_mutasi`
Mutasi faskes antar cabang (bisa cancelable).

```sql
create table wpa_mutasi (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid references wpa_faskes(id),
  kantor_asal uuid references wpa_kantor_cabang(id),
  kantor_tujuan uuid references wpa_kantor_cabang(id),
  alasan text,
  status text default 'pending',   -- pending, completed, cancelled
  initiated_by uuid,
  initiated_at timestamptz default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid
);
```

---

## RLS (Row Level Security) Policies

> **Catatan:** RLS di-enable untuk semua tabel. Service role bypass RLS via `service_role` key (dipakai di server-side `supabaseAdmin`).

Policy pattern (contoh untuk `wpa_pipeline`):

```sql
-- CM/Kabid/PP: lihat pipeline di cabang sendiri
create policy "cm_view_own_cabang" on wpa_pipeline
  for select using (
    kantor_cabang_id in (
      select kantor_cabang_id from wpa_users
      where auth.uid() = id  -- pseudo-code; RLS pakai function lain
    )
  );

-- PIC RS / Legal RS: lihat pipeline milik faskes sendiri
create policy "pic_view_own_faskes" on wpa_pipeline
  for select using (
    faskes_id in (
      select faskes_id from wpa_users
      where auth.uid() = id
    )
  );

-- Super Admin: lihat semua
-- (di-implement via service_role di server, RLS tidak perlu)
```

**Implementasi sebenarnya** di codebase: custom auth (bukan Supabase Auth), sehingga RLS tidak benar-benar dipakai untuk filtering. Semua query di-route via server-side `supabaseAdmin` (service_role) dengan filter manual `kantor_cabang_id` / `faskes_id` dari session user. RLS policies di DB ada sebagai defense-in-depth tapi bukan primary access control.

---

## Storage Buckets (Supabase Storage)

| Bucket | Path pattern | Isi |
|---|---|---|
| `wpa-templates` | `templates/{template_id}.docx` | Template .docx (sebelum migrasi) |
| `wpa-dokumen` | `pipeline/{pipeline_id}/{jenis}/{filename}` | Dokumen wajib pengajuan |
| `wpa-dokumen-operasional` | `dokumen-operasional/{faskes_id}/{filename}` | Surat menyurat post-PKS |
| `wpa-pks-final` | `pks/{pks_id}/signed.pdf` | PDF hasil scan TTD basah |
| `wpa-avatars` | `avatars/{user_id}.jpg` | Foto profil user |
| `wpa-tarif` | `tarif/{pipeline_id}/{filename}` | Excel tarif faskes untuk scan |
| `wpa-adendum-masal` | `adendum-masal/{template_id}.docx` | Template adendum masal |

---

## Migration Files (urutan eksekusi)

Jika mulai dari database kosong, eksekusi file SQL berikut berurutan:

```bash
# 1. Schema utama
scripts/wpa_schema.sql                    # tabel core + enum
scripts/wpa_fk_constraints.sql            # foreign key constraints

# 2. Fase 2-3
scripts/wpa_fase2_schema.sql              # dokumen pengajuan v2
scripts/wpa_fase3_schema.sql              # template placeholder detail

# 3. Pipeline ringkas (6 tahap)
scripts/wpa_tahap_ringkas_v2.sql          # update TAHAP_CONFIG_SEED

# 4. Drafting v2
scripts/wpa_drafting_v2_schema.sql        # wpa_pks_draft_versions

# 5. PKS Baru marker
scripts/wpa_pks_baru_marker.sql           # kolom can_submit_pks_baru

# 6. Tarif
scripts/wpa_tarif_v2.sql                  # tarif_acuan + tarif_faskes
scripts/wpa_tarif_standar.sql             # 75+ item tarif standar
scripts/wpa_ai_tarif_schema.sql           # wpa_ai_tarif_review

# 7. Adendum masal
scripts/wpa_adendum_masal_schema.sql

# 8. Dropping pusat
scripts/wpa_dropping_pusat_v2_schema.sql

# 9. Dokumen operasional
scripts/wpa_dok_ops_schema.sql

# 10. Dokumen pengajuan v2
scripts/wpa_dokumen_pengajuan_v2_schema.sql

# 11. Ensure columns (idempotent)
scripts/wpa_ensure_columns.sql

# 12. [AFTER MIGRATION] Tambah kolom Google Docs
sql/11_migration_to_google_docs.sql       # ada di paket backup ini
```

---

## Setelah Migrasi Google Docs

Lihat `sql/11_migration_to_google_docs.sql` untuk detail. Yang berubah:

1. `wpa_pks` → tambah `google_doc_id`, `google_doc_url`, `google_doc_shared_with`
2. `wpa_pks_template` → tambah `google_doc_template_id` (boleh kosong untuk transisi)
3. `wpa_pks_draft_versions` → tambah `google_doc_version_id`. Kolom `content_html` jangan di-drop dulu (backup), tapi stop writing to it
4. `wpa_dokumen_operasional` → tambah `google_doc_id`, `google_doc_url`
5. `wpa_pipeline` → tambah `google_doc_id`, `google_doc_url`, `google_doc_shared_with` (untuk adendum masal group-action)
