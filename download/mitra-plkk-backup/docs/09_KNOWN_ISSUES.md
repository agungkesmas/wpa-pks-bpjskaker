# 09 — Known Issues & Critical Bugs

> Hasil audit menyeluruh codebase. Dibagi jadi:
> 1. **Critical** — blocking, user tidak bisa pakai fitur ini sama sekali
> 2. **Major** — fitur jalan tapi hasil salah/menyesatkan user
> 3. **Minor** — cosmetic atau edge case

---

## 🔴 CRITICAL

### 1. `/api/template/upload` endpoint MISSING

**File yang missing:** `src/app/api/template/upload/route.ts`
**Dipanggil oleh:** `src/components/wpa/TemplateManager.tsx:97`
**Symptom:** Super Admin tidak bisa upload template PKS baru via UI. Tombol "Upload Template" → 404 error.
**Workaround sekarang:** Insert manual via Supabase dashboard (`wpa_pks_template` table) + upload .docx manual ke Storage bucket `wpa-templates`.
**Impact:** Tanpa template, `/api/drafting/start` return 400 ("Template pks belum diupload"). Drafting tidak bisa dimulai.
**Fix:** Buat endpoint POST yang:
1. Receive multipart/form-data dengan file .docx + metadata (jenis_pipeline, nama, version)
2. Upload ke Supabase Storage `wpa-templates/{template_id}.docx`
3. Insert record ke `wpa_pks_template` (file_docx_path, is_active=true)
4. Extract placeholders via mammoth (atau regex `{{KEY}}`) → insert ke `wpa_pks_template_placeholder`
5. Return `{ ok: true, template_id }`

### 2. `/api/pengajuan-dokumen/upload` endpoint MISSING

**File yang missing:** `src/app/api/pengajuan-dokumen/upload/route.ts`
**Dipanggil oleh:**
- `src/components/wpa/FileUploader.tsx:91` (PIC RS upload 7 dokumen wajib pks_baru)
- `src/components/wpa/CMTakeoverModal.tsx:35` (CM takeover mode file_upload)
**Symptom:** PIC RS tidak bisa upload dokumen wajib. Tombol "Upload" → 404.
**Impact:** **PIPA PKS BARU/PERPANJANGAN/ADENDUM BROKEN END-TO-END.** `/api/pengajuan-draft/submit` selalu return `{ valid: false, missing: [...] }` karena `wpa_dokumen_pengajuan` table kosong. Pipeline tidak bisa advance dari tahap `diajukan`.
**Workaround sekarang:** Tidak ada. User stuck.
**Fix:** Buat endpoint POST yang:
1. Receive multipart/form-data (file + pipeline_id + jenis)
2. Validate jenis sesuai enum `wpa_dokumen_pengajuan_jenis`
3. Upload ke Storage `wpa-dokumen/{pipeline_id}/{jenis}/{filename}`
4. Insert ke `wpa_dokumen_pengajuen` (pipeline_id, jenis, label, file_path, mime_type, file_size, uploaded_by)
5. Return `{ ok: true, dokumen_id }`

### 3. `DocumentEditor.tsx` wired to wrong API

**File:** `src/components/wpa/DocumentEditor.tsx:46-50`
**Symptom:** Tombol "Rapihkan Format (WYSIWYG)" di `DraftingPKSView.tsx:432` panggil `<DocumentEditor dokumenId={pksId}>`. Tapi `DocumentEditor` fetch `/api/dokumen-operasional/preview?id=${dokumenId}` yang query tabel `wpa_dokumen_operasional`. `pksId` adalah ID dari `wpa_pks` (tabel berbeda) → 404.
**Impact:** Fitur "Rapihkan Format" dead code. User klik → toast "Dokumen tidak ditemukan".
**Fix:** Setelah migrasi Google Docs, **DELETE `DocumentEditor.tsx` seluruhnya.** Tidak perlu lagi.

### 4. `mammoth` HTML conversion lossy (root cause of formatting problem)

**File:** `src/app/api/drafting/generate/route.ts:62-64`
**Symptom:** Template .docx → mammoth → HTML → replace placeholder → save. mammoth membuang:
- Headers/footers + page numbers
- Watermark (kalau ada)
- BPJS letterhead / logo
- Tabel dengan merged cells (colspan/rowspan)
- Tabel column widths
- Embedded images
- Multi-column layout
- Drop caps
- Text boxes
- Footnotes
- Tracked changes
**Impact:** Tampilan draft tidak cocok dengan template .docx asli. CM dan PIC RS lihat HTML yang berbeda jauh dari Word asli. Print hasil `window.print()` tidak akan diterima tim legal BPJS.
**Fix:** **Migrasi ke Google Docs + Apps Script.** Lihat `docs/10_MIGRATION_PLAN.md`.

### 5. `CMTakeoverModal.tsx` system_edit mode = plain Textarea (misleading)

**File:** `src/components/wpa/CMTakeoverModal.tsx:147-156`
**Symptom:** UI label bilang "Edit di Sistem (TipTap)". Reality: `<Textarea className="font-mono text-xs">` untuk HTML mentah.
**Impact:** CM musti hand-write HTML untuk dokumen legal. Tidak realistis.
**Fix:** Setelah migrasi, ganti dengan: "Buka di Google Docs (Editor Mode)" → langsung share Google Doc sebagai editor ke CM, dan advance tahap otomatis setelah CM klik "Sudah Selesai Edit".

---

## 🟠 MAJOR

### 6. TipTap missing Table extension

**File:** `src/components/wpa/DocumentEditor.tsx:24-32`
**Symptom:** `@tiptap/extension-table` ada di `package.json:30` tapi tidak di-import di `DocumentEditor.tsx`.
**Impact:** Kalau dokumen punya tabel (mis. tabel tarif di Pasal 4), tabel akan HILANG saat user buka WYSIWYG editor. Save → tabel hilang permanen.
**Fix:** Setelah migrasi, **delete `DocumentEditor.tsx`**. Tidak relevan lagi.

### 7. `contentEditable` + `dangerouslySetInnerHTML` brittle

**File:** `src/components/wpa/DraftingPKSView.tsx:531-538`
**Symptom:** Browser normalize HTML inkonsisten (Chrome vs Edge vs Firefox). User klik di tengah paragraf bisa insert `<span>` tidak terduga, drop attributes, merge tags.
**Impact:** Editing tidak stabil. Kadang format berubah tanpa user sadari.
**Plus:** Char-count tracking per `<p>` (`DraftingPKSView.tsx:324-344`) jadi tidak reliable karena `querySelectorAll` index shift kalau browser insert node.
**Fix:** Migrasi Google Docs. Hapus `contentEditable` dari `DraftingPKSView`.

### 8. Placeholder substitution case-sensitive + no escape

**File:** `src/app/api/drafting/generate/route.ts:67-72` dan `dokumen-operasional/preview/route.ts:77-81`
**Symptom:**
- Regex `\\{\\{${key}\\}\\}` case-sensitive. Kalau template pakai `{{nama_faskes}}` (lowercase), tidak ke-replace.
- `String(value||'')` tanpa escape HTML. Kalau value ada `<` atau `&` atau `"`, akan inject sebagai HTML → bisa break structure + XSS.
**Impact:** Beberapa placeholder mungkin tidak ter-replace (silent failure). XSS risk (kalau PIC RS input nilai berbahaya — rendah kemungkinan tapi tetap risiko).
**Fix:** Setelah migrasi, Apps Script pakai `body.replaceText()` Google Docs yang literal replacement (aman dari HTML injection). Case-sensitivity tetap issue → pastikan template pakai UPPERCASE (lihat `docs/05_PLACEHOLDERS.md`).

### 9. Adendum masal PDF tidak pernah di-generate

**File:** `src/app/api/adendum-masal/group-action/route.ts:106`
**Symptom:** Notification text: "PDF siap di-print untuk TTD basah". Tapi kolom `pdf_generated_url` di `wpa_pipeline` **tidak pernah di-write** (confirmed via grep).
**Impact:** User dapet notifikasi PDF ready, tapi tidak ada PDF. Click "Download PDF" → 404 atau button tidak muncul.
**Fix:** Setelah migrasi, generate via Apps Script `generate_bulk` → return array doc URLs. Set `pdf_generated_url` (atau rename ke `google_doc_url`) untuk setiap pipeline.

### 10. `pdf_generated_url` kolom tidak pernah di-write

**Confirmed via grep:** Hanya 3 reference di codebase:
- 1 di worklog.md (claim done)
- 1 di schema comment
- 1 di `pipeline/detail/[id]/route.ts:76` (explicitly set to null)
**Fix:** Setelah migrasi, ganti nama kolom jadi `google_doc_url`, dan write setiap generate.

### 11. `experimental.serverComponentsExternalPackages` deprecated

**File:** `next.config.js` atau `next.config.ts`
**Symptom:** Next.js 16 rename jadi `serverExternalPackages`. Build warning.
**Fix:** Sudah di-fix di current codebase (based on summary). Tapi verify kalau masih ada warning.

### 12. `useSearchParams` tanpa Suspense

**Symptom:** Next.js 16 require Suspense boundary untuk `useSearchParams`. Beberapa page error saat build.
**Fix:** Sudah di-fix di current codebase. Verify kalau masih ada page yang error.

---

## 🟡 MINOR

### 13. `admin_kantor` role dihapus tapi masih ada di enum DB

**Status:** `wpa_user_role` enum masih punya value `admin_kantor`. Tapi code z.enum sudah dihapus.
**Impact:** Tidak blocking. Tapi kalau ada user lama dengan role `admin_kantor` di DB, mereka tidak bisa login (validation error).
**Fix:** Jalankan SQL:
```sql
-- Hapus user dengan role admin_kantor dulu (kalau ada)
DELETE FROM wpa_users WHERE role = 'admin_kantor';
-- Hapus value dari enum
ALTER TYPE wpa_user_role REMOVE VALUE admin_kantor;
```

### 14. Zod v4 `z.record(z.any())` requires 2 args

**Symptom:** Zod v4 breaking change. `z.record(z.any())` harus `z.record(z.string(), z.any())`.
**Fix:** Sudah di-fix di current codebase. Verify.

### 15. Login redirect stuck on /login

**Symptom:** Setelah login success, client-side `router.push('/case_manager')` tidak trigger full reload, page stuck.
**Workaround:** User manual refresh.
**Fix:** Pakai `window.location.href = '/case_manager'` instead of `router.push`. Atau return redirect URL dari API dan pakai `window.location.replace`.

### 16. Performance: `getSession()` tidak di-cache

**Symptom:** Setiap server component call `getSession()` → fetch DB. Banyak component di page yang sama → multiple fetch.
**Fix:** Sudah di-fix dengan `React.cache()` (based on summary). Verify dengan profiling.

### 17. BotReceptionist heavy bundle

**Symptom:** BotReceptionist component membengkakkan bundle size login page.
**Fix:** Sudah di-fix dengan dynamic import (based on summary). Verify.

### 18. `KantorDetailManager.tsx` missing batch deactivate

**File:** `src/components/wpa/KantorDetailManager.tsx:358`
**Symptom:** Comment `// TODO: batch deactivate`. Fitur belum diimplemen.
**Fix:** Implement kalau perlu. Low priority.

---

## 🟢 POST-MIGRATION CLEANUP

Hal-hal yang harus dilakukan SETELAH migrasi Google Docs selesai:

### Hapus file tidak terpakai:
- `src/components/wpa/DocumentEditor.tsx` (TipTap)
- `src/app/api/drafting/generate/route.ts` (mammoth-based)
- `src/app/api/dokumen-operasional/preview/route.ts` (kalau TipTap dihapus)

### Hapus dependency dari package.json:
- `mammoth`
- `@tiptap/core`
- `@tiptap/starter-kit`
- `@tiptap/extension-underline`
- `@tiptap/extension-text-align`
- `@tiptap/extension-highlight`
- `@tiptap/extension-table` (tidak pernah dipakai)
- `docx` (tidak pernah dipakai)

### Alter DB schema:
```sql
-- Backup dulu sebelum drop
ALTER TABLE wpa_pks_draft_versions
  RENAME COLUMN content_html TO content_html_deprecated;

-- Tidak drop kolom, biarkan untuk rollback kalau perlu
```

### Update komponen yang masih reference HTML:
- `DraftingPKSView.tsx` → hapus semua logic terkait `contentEditable`, `dangerouslySetInnerHTML`, char-count tracking, PreviewModal
- `CMReviewDraft.tsx` → hapus HTML diff, ganti dengan Google Docs embed
- `CMTakeoverModal.tsx` → hapus textarea HTML
- `PipelineDetailView.tsx` → ganti `window.print()` dengan tombol "Download .docx" (link ke Google export URL)
- `DokumenOperasionalView.tsx` → ganti TipTap dengan embed Google Docs (atau pindah ke Google Docs sepenuhnya)

---

## Catatan untuk AI/Developer Pengganti

1. **Jangan percaya worklog 100%.** Worklog mengklaim hal-hal yang tidak sesuai codebase. Selalu verify dengan baca file sebenarnya.
2. **Test end-to-end sebelum claim "done".** Build success ≠ fitur jalan. Buka browser, coba flow sebenarnya.
3. **Audit regression diam-diam.** Beberapa fitur yang dulu jalan sekarang broken (lihat #1, #2, #9). Cari reference ke fitur itu di codebase sebelum asumsi masih jalan.
4. **Migrasi Google Docs adalah prioritas #1.** Tanpa itu, semua fitur drafting dokumen PKS tidak bisa dipakai production. Lihat `docs/10_MIGRATION_PLAN.md`.
