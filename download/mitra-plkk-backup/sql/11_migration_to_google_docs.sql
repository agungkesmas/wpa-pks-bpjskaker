-- ============================================================
-- MIGRATION: Add Google Docs columns to wpa_pks, wpa_pipeline,
-- wpa_pks_draft_versions, wpa_pks_template, wpa_dokumen_operasional
-- ============================================================
-- Run this AFTER:
--   1. All previous wpa_*.sql migrations (see docs/04_DATABASE_SCHEMA.md)
--   2. Before deploying migrated Next.js code
--
-- This migration is BACKWARD COMPATIBLE:
--   - New columns are nullable (no NOT NULL constraint)
--   - Old columns (content_html) are renamed, NOT dropped
--   - Code can run in either mode (old mammoth or new Google Docs)
--     via MIGRATION_GOOGLE_DOCS_ENABLED env flag
--
-- Target DB: Supabase project hfhvsiuebrwrqmqzsroc
-- Date: 2026-07-17
-- ============================================================

-- ============================================================
-- 1. wpa_pks — tambah kolom Google Docs
-- ============================================================
ALTER TABLE wpa_pks
  ADD COLUMN IF NOT EXISTS google_doc_id text,
  ADD COLUMN IF NOT EXISTS google_doc_url text,
  ADD COLUMN IF NOT EXISTS google_doc_shared_with jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN wpa_pks.google_doc_id IS 'Google Docs document ID (setelah migrasi ke Google Docs + Apps Script)';
COMMENT ON COLUMN wpa_pks.google_doc_url IS 'Google Docs edit URL (https://docs.google.com/document/d/...)';
COMMENT ON COLUMN wpa_pks.google_doc_shared_with IS 'Array of {email, role, shared_at} untuk tracking siapa yang sudah di-share';

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_wpa_pks_google_doc_id ON wpa_pks(google_doc_id) WHERE google_doc_id IS NOT NULL;


-- ============================================================
-- 2. wpa_pipeline — tambah kolom Google Docs
-- ============================================================
ALTER TABLE wpa_pipeline
  ADD COLUMN IF NOT EXISTS google_doc_id text,
  ADD COLUMN IF NOT EXISTS google_doc_url text,
  ADD COLUMN IF NOT EXISTS google_doc_shared_with jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN wpa_pipeline.google_doc_id IS 'Google Docs document ID untuk draft PKS/adendum di pipeline ini';
COMMENT ON COLUMN wpa_pipeline.google_doc_url IS 'Google Docs edit URL';

CREATE INDEX IF NOT EXISTS idx_wpa_pipeline_google_doc_id ON wpa_pipeline(google_doc_id) WHERE google_doc_id IS NOT NULL;


-- ============================================================
-- 3. wpa_pks_draft_versions — tambah google_doc_version_id
--    + rename content_html → content_html_deprecated (jangan drop!)
-- ============================================================
ALTER TABLE wpa_pks_draft_versions
  ADD COLUMN IF NOT EXISTS google_doc_version_id text;

-- Rename content_html ke content_html_deprecated (kalau ada)
-- Cek dulu apakah kolom content_html ada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wpa_pks_draft_versions'
      AND column_name = 'content_html'
  ) THEN
    ALTER TABLE wpa_pks_draft_versions RENAME COLUMN content_html TO content_html_deprecated;
  END IF;
END $$;

COMMENT ON COLUMN wpa_pks_draft_versions.google_doc_version_id IS 'Google Docs revision ID untuk version tracking. Setelah migrasi, ini primary source.';
COMMENT ON COLUMN wpa_pks_draft_versions.content_html_deprecated IS 'DEPRECATED — HTML content dari mammoth (sebelum migrasi Google Docs). Dibiarkan untuk rollback. Jangan write ke kolom ini lagi.';

CREATE INDEX IF NOT EXISTS idx_wpa_draft_versions_google_doc ON wpa_pks_draft_versions(google_doc_version_id) WHERE google_doc_version_id IS NOT NULL;


-- ============================================================
-- 4. wpa_pks_template — tambah google_doc_template_id
-- ============================================================
ALTER TABLE wpa_pks_template
  ADD COLUMN IF NOT EXISTS google_doc_template_id text;

COMMENT ON COLUMN wpa_pks_template.google_doc_template_id IS 'Google Docs template ID (untuk clone via Apps Script). Kalau NULL, fallback ke file_docx_path (lama).';

CREATE INDEX IF NOT EXISTS idx_wpa_pks_template_google_doc ON wpa_pks_template(google_doc_template_id) WHERE google_doc_template_id IS NOT NULL;


-- ============================================================
-- 5. wpa_dokumen_operasional — tambah Google Docs columns
-- ============================================================
ALTER TABLE wpa_dokumen_operasional
  ADD COLUMN IF NOT EXISTS google_doc_id text,
  ADD COLUMN IF NOT EXISTS google_doc_url text;

COMMENT ON COLUMN wpa_dokumen_operasional.google_doc_id IS 'Google Docs document ID untuk dokumen operasional (surat menyurat post-PKS)';
COMMENT ON COLUMN wpa_dokumen_operasional.google_doc_url IS 'Google Docs edit URL';


-- ============================================================
-- 6. wpa_adendum_masal_template — tambah google_doc_template_id
-- ============================================================
ALTER TABLE wpa_adendum_masal_template
  ADD COLUMN IF NOT EXISTS google_doc_template_id text;

COMMENT ON COLUMN wpa_adendum_masal_template.google_doc_template_id IS 'Google Docs template ID untuk adendum masal (dipakai Apps Script generate_bulk)';


-- ============================================================
-- 7. Migration tracking — record bahwa migration ini sudah run
-- ============================================================
CREATE TABLE IF NOT EXISTS wpa_migrations (
  id serial primary key,
  migration_name text unique not null,
  applied_at timestamptz default now(),
  applied_by text,
  notes text
);

INSERT INTO wpa_migrations (migration_name, notes)
VALUES ('11_migration_to_google_docs', 'Add google_doc_id, google_doc_url, google_doc_shared_with columns. Rename content_html → content_html_deprecated.')
ON CONFLICT (migration_name) DO NOTHING;


-- ============================================================
-- 8. Verification queries — jalankan untuk verifikasi
-- ============================================================
-- SELECT
--   table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name LIKE 'wpa_%'
--   AND column_name LIKE 'google_doc%'
-- ORDER BY table_name, column_name;
-- Expected output:
--   wpa_adendum_masal_template | google_doc_template_id | text
--   wpa_dokumen_operasional    | google_doc_id          | text
--   wpa_dokumen_operasional    | google_doc_url         | text
--   wpa_pks                    | google_doc_id          | text
--   wpa_pks                    | google_doc_shared_with | jsonb
--   wpa_pks                    | google_doc_url         | text
--   wpa_pks_draft_versions     | google_doc_version_id  | text
--   wpa_pks_template           | google_doc_template_id | text
--   wpa_pipeline               | google_doc_id          | text
--   wpa_pipeline               | google_doc_shared_with | jsonb
--   wpa_pipeline               | google_doc_url         | text


-- ============================================================
-- ROLLBACK SCRIPT (kalau perlu revert)
-- ============================================================
-- HATI-HATI: jangan rollback kalau sudah ada data Google Docs
-- yang terpakai. Backup dulu sebelum run.
--
-- -- Restore content_html
-- DO $$
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_name = 'wpa_pks_draft_versions'
--       AND column_name = 'content_html_deprecated'
--   ) THEN
--     ALTER TABLE wpa_pks_draft_versions RENAME COLUMN content_html_deprecated TO content_html;
--   END IF;
-- END $$;
--
-- -- Drop Google Docs columns
-- ALTER TABLE wpa_pks
--   DROP COLUMN IF EXISTS google_doc_id,
--   DROP COLUMN IF EXISTS google_doc_url,
--   DROP COLUMN IF EXISTS google_doc_shared_with;
--
-- ALTER TABLE wpa_pipeline
--   DROP COLUMN IF EXISTS google_doc_id,
--   DROP COLUMN IF EXISTS google_doc_url,
--   DROP COLUMN IF EXISTS google_doc_shared_with;
--
-- ALTER TABLE wpa_pks_draft_versions
--   DROP COLUMN IF EXISTS google_doc_version_id;
--
-- ALTER TABLE wpa_pks_template
--   DROP COLUMN IF EXISTS google_doc_template_id;
--
-- ALTER TABLE wpa_dokumen_operasional
--   DROP COLUMN IF EXISTS google_doc_id,
--   DROP COLUMN IF EXISTS google_doc_url;
--
-- ALTER TABLE wpa_adendum_masal_template
--   DROP COLUMN IF EXISTS google_doc_template_id;
--
-- DELETE FROM wpa_migrations WHERE migration_name = '11_migration_to_google_docs';
