-- ============================================================
-- MIGRATION: AI API Keys + Tarif Acuan standar
-- ============================================================

-- 1. Tabel wpa_ai_api_keys — multi-provider, auto-rotate
create table if not exists wpa_ai_api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gemini', 'openai', 'zhipu', 'deepseek', 'qwen', 'claude')),
  label text,
  api_key text not null,
  base_url text,
  model text,
  is_active boolean default true,
  is_default boolean default false,
  last_used_at timestamptz,
  last_error text,
  error_count int default 0,
  quota_exhausted boolean default false,
  quota_reset_at timestamptz,
  created_by uuid references wpa_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_wpa_ai_keys_provider on wpa_ai_api_keys(provider, is_active);

-- 2. Tambah kolom nama_item_alias + nama_item_standar di wpa_tarif_acuan
alter table wpa_tarif_acuan
  add column if not exists nama_item_standar text,
  add column if not exists nama_item_alias text[];

-- Update existing rows: set nama_item_standar = nama_item (kalau null)
update wpa_tarif_acuan set nama_item_standar = nama_item where nama_item_standar is null;

-- 3. Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- 4. Seed default Gemini key (dari user)
insert into wpa_ai_api_keys (provider, label, api_key, model, is_active, is_default)
values ('gemini', 'Gemini Default', 'AIzaSyAj4cGSZjBkLTbKcKuBGCqudy4rNjIGTZ0', 'gemini-2.0-flash', true, true)
on conflict do nothing;

-- 5. Verifikasi
select provider, label, is_active, is_default from wpa_ai_api_keys;
