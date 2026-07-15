-- ============================================================
-- MIGRATION: Kolom can_submit_pks_baru di wpa_users
-- ============================================================
-- Marker untuk PIC RS yang boleh upload PKS Baru.
-- CM set true saat create user PIC RS.
-- PIC RS set false otomatis setelah submit PKS Baru.
-- ============================================================

alter table wpa_users
  add column if not exists can_submit_pks_baru boolean default false;

comment on column wpa_users.can_submit_pks_baru is 'True jika PIC RS boleh upload PKS Baru. Set oleh CM saat create user. Auto-set false setelah PIC RS submit PKS Baru.';

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- Verifikasi
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'wpa_users' and column_name = 'can_submit_pks_baru';
