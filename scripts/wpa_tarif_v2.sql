-- ============================================================
-- TARIF SCHEMA v2 — Per Kantor Cabang Acuan + Faskes Upload
-- ============================================================
-- Konsep:
--   1. wpa_tarif_acuan: tarif referensi per kantor cabang (input case manager)
--      - Bisa input manual (1 nilai) ATAU multi-RS sample (sistem hitung mean/median/std_dev)
--   2. wpa_tarif_faskes: tarif yang diupload faskes (Excel .xlsx)
--      - Saat upload, sistem auto-compare dengan acuan → status kewajaran terisi
--   3. wpa_tarif_upload_batch: log setiap upload file (1 file = 1 batch, N items)
-- ============================================================

-- Drop tabel lama yang salah konsep
drop table if exists wpa_tarif_comparison cascade;
drop table if exists wpa_tarif_bank cascade;
-- wpa_tarif_kewajaran_rule tetap dipakai (untuk threshold per kategori)

-- ============================================================
-- 1. TARIF ACUAN (per kantor cabang, per kategori, per item, per tahun)
-- ============================================================
create table if not exists wpa_tarif_acuan (
  id uuid primary key default gen_random_uuid(),
  kantor_cabang_id uuid not null references wpa_kantor_cabang(id) on delete cascade,
  kategori wpa_tarif_kategori not null,
  nama_item text not null,
  satuan text,
  
  -- Nilai acuan final (yang dipakai untuk comparison)
  tarif_acuan numeric(14,2) not null,
  
  -- Statistik dari sample (diisi kalau sumber='calculation')
  tarif_min numeric(14,2),
  tarif_max numeric(14,2),
  tarif_median numeric(14,2),
  tarif_mean numeric(14,2),
  tarif_std_dev numeric(14,2),
  sample_count int default 0,
  sample_data jsonb default '[]'::jsonb,  -- [{rs_nama, tarif}, ...]
  
  tahun int not null default extract(year from current_date),
  sumber text not null default 'manual' check (sumber in ('manual','calculation')),
  catatan text,
  is_active boolean default true,
  
  created_by uuid references wpa_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(kantor_cabang_id, kategori, nama_item, tahun)
);

create index if not exists idx_wpa_tarif_acuan_cabang on wpa_tarif_acuan(kantor_cabang_id, tahun);
create index if not exists idx_wpa_tarif_acuan_kategori on wpa_tarif_acuan(kategori, nama_item);
create index if not exists idx_wpa_tarif_acuan_active on wpa_tarif_acuan(is_active);

-- ============================================================
-- 2. UPLOAD BATCH (1 file upload = 1 batch)
-- ============================================================
create table if not exists wpa_tarif_upload_batch (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid not null references wpa_faskes(id) on delete cascade,
  kantor_cabang_id uuid references wpa_kantor_cabang(id) on delete set null,
  file_name text not null,
  file_size bigint,
  file_url text,
  mime_type text default 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  item_count int default 0,
  item_compared int default 0,
  item_no_acuan int default 0,
  status text default 'processing' check (status in ('processing','processed','failed','partial')),
  error_log text,
  uploaded_by uuid references wpa_users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_wpa_tarif_batch_faskes on wpa_tarif_upload_batch(faskes_id, created_at);

-- ============================================================
-- 3. TARIF FASKES (per item per upload, dengan auto-comparison)
-- ============================================================
do $$ begin
  create type wpa_tarif_kewajaran_status as enum ('wajar','perlu_review','tinggi','rendah','ekstrem','no_acuan');
exception when duplicate_object then null; end $$;

create table if not exists wpa_tarif_faskes (
  id uuid primary key default gen_random_uuid(),
  faskes_id uuid not null references wpa_faskes(id) on delete cascade,
  kantor_cabang_id uuid references wpa_kantor_cabang(id) on delete set null,
  upload_batch_id uuid references wpa_tarif_upload_batch(id) on delete cascade,
  
  kategori wpa_tarif_kategori not null,
  nama_item text not null,
  satuan text,
  tarif numeric(14,2) not null,
  tahun int not null default extract(year from current_date),
  
  -- Auto-comparison result (diisi saat upload)
  tarif_acuan_id uuid references wpa_tarif_acuan(id) on delete set null,
  tarif_acuan numeric(14,2),
  selisih numeric(14,2),  -- tarif - tarif_acuan
  selisih_percent numeric(8,2),
  z_score numeric(8,2),
  status_kewajaran wpa_tarif_kewajaran_status,
  
  catatan text,
  uploaded_by uuid references wpa_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_wpa_tarif_faskes_faskes on wpa_tarif_faskes(faskes_id, tahun);
create index if not exists idx_wpa_tarif_faskes_status on wpa_tarif_faskes(status_kewajaran);
create index if not exists idx_wpa_tarif_faskes_batch on wpa_tarif_faskes(upload_batch_id);
create index if not exists idx_wpa_tarif_faskes_cabang on wpa_tarif_faskes(kantor_cabang_id, kategori);

-- Update kewajaran rule: tambah default threshold jika belum ada
insert into wpa_tarif_kewajaran_rule (kategori, min_percentile_5, max_percentile_95, std_dev_threshold, catatan)
values
  ('kamar', null, null, 2.0, 'Tarif kamar per hari'),
  ('operasi_kecil', null, null, 2.0, 'Tarif operasi kecil'),
  ('operasi_sedang', null, null, 2.0, 'Tarif operasi sedang'),
  ('operasi_besar', null, null, 2.0, 'Tarif operasi besar'),
  ('laboratorium', null, null, 2.0, 'Tarif lab per item'),
  ('radiologi', null, null, 2.0, 'Tarif radiologi per item'),
  ('tindakan_medis', null, null, 2.0, 'Tarif tindakan medis'),
  ('rawat_inap', null, null, 2.0, 'Tarif rawat inap per hari'),
  ('obat', null, null, 2.0, 'Tarif obat per item'),
  ('admin', null, null, 2.0, 'Biaya administrasi'),
  ('lainnya', null, null, 2.0, 'Lainnya')
on conflict (kategori) do nothing;

-- ============================================================
-- 4. RPC FUNCTION: Hitung status kewajaran otomatis
-- ============================================================
-- Input: tarif faskes, tarif acuan, std_dev (nullable)
-- Output: status, selisih, selisih_percent, z_score
create or replace function wpa_calc_kewajaran(
  p_tarif numeric,
  p_acuan numeric,
  p_std_dev numeric default null
) returns table(
  status wpa_tarif_kewajaran_status,
  selisih numeric,
  selisih_percent numeric,
  z_score numeric
) as $$
declare
  v_selisih numeric;
  v_pct numeric;
  v_z numeric;
begin
  if p_acuan is null or p_acuan = 0 then
    return query select 'no_acuan'::wpa_tarif_kewajaran_status, null::numeric, null::numeric, null::numeric;
    return;
  end if;
  
  v_selisih := p_tarif - p_acuan;
  v_pct := round((v_selisih / p_acuan * 100)::numeric, 2);
  
  -- z-score hanya jika std_dev ada dan > 0
  if p_std_dev is not null and p_std_dev > 0 then
    v_z := round(((p_tarif - p_acuan) / p_std_dev)::numeric, 2);
  else
    v_z := null;
  end if;
  
  -- Tentukan status berdasarkan selisih_percent (fallback) atau z_score
  -- Prioritas: z_score jika ada, jika tidak pakai selisih_percent
  if v_z is not null then
    if abs(v_z) > 3 then
      return query select 'ekstrem'::wpa_tarif_kewajaran_status, v_selisih, v_pct, v_z;
    elsif v_z > 2 then
      return query select 'tinggi'::wpa_tarif_kewajaran_status, v_selisih, v_pct, v_z;
    elsif v_z < -2 then
      return query select 'rendah'::wpa_tarif_kewajaran_status, v_selisih, v_pct, v_z;
    elsif abs(v_z) > 1 then
      return query select 'perlu_review'::wpa_tarif_kewajaran_status, v_selisih, v_pct, v_z;
    else
      return query select 'wajar'::wpa_tarif_kewajaran_status, v_selisih, v_pct, v_z;
    end if;
  else
    -- Fallback: pakai selisih_percent
    if abs(v_pct) > 50 then
      return query select 'ekstrem'::wpa_tarif_kewajaran_status, v_selisih, v_pct, null::numeric;
    elsif v_pct > 25 then
      return query select 'tinggi'::wpa_tarif_kewajaran_status, v_selisih, v_pct, null::numeric;
    elsif v_pct < -25 then
      return query select 'rendah'::wpa_tarif_kewajaran_status, v_selisih, v_pct, null::numeric;
    elsif abs(v_pct) > 10 then
      return query select 'perlu_review'::wpa_tarif_kewajaran_status, v_selisih, v_pct, null::numeric;
    else
      return query select 'wajar'::wpa_tarif_kewajaran_status, v_selisih, v_pct, null::numeric;
    end if;
  end if;
end;
$$ language plpgsql immutable;

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
