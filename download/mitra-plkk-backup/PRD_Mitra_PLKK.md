# PRD — Mitra PLKK
### Product Requirements Document untuk Handover

**Versi:** 1.0 (final backup)
**Tanggal:** 17 Juli 2026
**Tujuan dokumen:** Spesifikasi lengkap aplikasi Mitra PLKK untuk handover ke AI/developer pengganti, termasuk rencana migrasi ke Google Docs + Apps Script.

---

## 1. Executive Summary

**Mitra PLKK** adalah aplikasi web internal BPJS Ketenagakerjaan untuk mengelola siklus hidup PKS (Perjanjian Kerja Sama) dengan Faskes Pusat Layanan Kecakapan Kerja (PLKK). Aplikasi dibangun dengan Next.js 16 + Supabase, sudah mencapai ~60% completion. Lapisan workflow (pipeline state machine, RBAC, audit, notifikasi, dashboard) sudah solid dan siap production. Tapi lapisan rendering/edit/print dokumen PKS (yang paling kritis) broken dari akar — memakai `mammoth` (lossy HTML conversion) + `contentEditable` + `window.print()` yang tidak akan pernah bisa memenuhi standar legal BPJS.

**Keputusan:** Migrasi lapisan dokumen ke Google Docs + Apps Script. Sisa aplikasi tetap di Next.js. Effort 5-6 hari kerja, $0 biaya infra.

---

## 2. Latar Belakang & Masalah

### 2.1. Konteks Bisnis

PLKK (Pusat Layanan Kecakapan Kerja) adalah fasilitas kesehatan (RS, Klinik) yang menjadi rujukan tetap untuk kasus kecelakaan kerja peserta BPJS Ketenagakerjaan. PKS mengatur tarif layanan, kewajiban masing-masing pihak, dan jangka waktu kerja sama (umumnya 3 tahun). Tanpa PKS aktif, faskes tidak bisa mengklaim biaya layanan ke BPJS.

### 2.2. Masalah Sebelum Mitra PLKK

1. **PKS management manual & tersebar** — via email, Excel, Word attachment, folder fisik. Tidak ada visibility real-time, sering telat perpanjangan, sulit audit.
2. **Tidak ada standardisasi tarif** — setiap faskes ajukan tarif sendiri, CM review manual tanpa acuan baku. Tarif untuk item yang sama bisa beda 2x lipat antar faskes.
3. **Adendum masal tidak scalable** — saat ada kebijakan baru, butuh berbulan-bulan untuk kirim adendum ke ratusan faskes.
4. **Tidak ada reminder PKS berakhir** — banyak faskes baru sadar PKS expired ketika klaim ditolak.

### 2.3. Solusi Mitra PLKK

1. **Workflow pipeline terpusat** — 7 jenis pengajuan × 6 tahap state machine, dengan status real-time, notifikasi otomatis, audit log.
2. **Sistem tarif acuan + AI scan** — Bank Tarif Standar (75+ item), 2 mode acuan (Provinsi ceiling / Rata-rata Daerah), pattern scan deterministic + AI second opinion opsional.
3. **Adendum masal** — template-driven, CM group review (1 klik approve 50 faskes sekaligus).
4. **Dashboard action-oriented** — setiap role lihat "5 hal yang perlu Anda aksi hari ini" dengan button context-aware.
5. **Auto-clone perpanjangan** — 80% data dari PKS lama ter-copy otomatis, PIC RS tinggal isi 20% sisanya.

---

## 3. Target User & Role

| Role | Singkat | Lokasi | Tugas utama |
|---|---|---|---|
| Super Admin | SA | Kantor Pusat | Master data, user management, audit |
| Case Manager | CM | Per kantor cabang | Front-liner pengelolaan pipeline PKS |
| Kepala Bidang | Kabid | Per kantor cabang | Approval 4-eyes, TTD basah |
| Penata Pelayanan | PP | Per kantor cabang | Ambil alih tugas CM, pembinaan faskes |
| PIC RS | PIC | Di faskes (external) | Submit pengajuan, upload dokumen, isi data |
| Legal RS | Legal | Di faskes (external, RS besar) | Review draft PKS dari sisi hukum RS |

**Skala:** ~450 user BPJS (1 SA + 150 cabang × 3 role) + ~3300 user external (PIC RS + Legal RS) = ~3750 user potensial.

**Auth:** Email + password (custom, bukan Supabase Auth). Session via signed JWT in HTTP-only cookie.

**Multi-tenant:** Filter via `kantor_cabang_id` (BPJS users) atau `faskes_id` (external users). Super Admin bypass via `service_role`.

---

## 4. Pipeline State Machine

### 4.1. Tahapan (max 6 tahap)

```
diajukan → ditinjau_kajian_tarif → kredensialing → drafting_pks/drafting_adendum → approval_kabid → review_legal_rs → tanda_tangan → completed
```

### 4.2. Jenis Pengajuan (7 total)

| Jenis | Tahap | SLA Total | Keterangan |
|---|---|---|---|
| `pks_baru` | 6 tahap | 24 hari | PKS baru faskes |
| `perpanjangan` | 6 tahap | 24 hari | Perpanjangan PKS berakhir, auto-clone data |
| `adendum_harga` | 6 tahap | 24 hari | Perubahan tarif |
| `adendum_layanan_baru` | 6 tahap | 24 hari | Penambahan layanan baru |
| `adendum_dropping` | 4 tahap | 24 hari | Hapus faskes dari daftar PLKK cabang |
| `adendum_masal` | 3 tahap | 4 hari | Adendum template untuk multiple faskes |
| `perubahan_data` | 5 tahap | 16 hari | Perubahan data faskes (nama, PJ, bank) |

### 4.3. Drafting Sub-Flow (Detail)

```
PIC RS start drafting → isi 81 placeholder → Generate Draft
       ↓
Submit untuk Review CM (save version v1)
       ↓
CM Review Draft → 3 cabang:
  ├── Approve → advance ke approval_kabid
  ├── Return with catatan → balik ke PIC RS → revisi → v2 → submit lagi
  └── Takeover (setelah 3x koreksi atau kasus khusus):
        ├── System edit mode (CM edit langsung di editor)
        └── File upload mode (CM upload .docx final)
```

Max 4 versions (v1, v2, v3, v4 dengan v4 = CM takeover). Setiap version tersimpan di `wpa_pks_draft_versions` dengan catatan CM.

---

## 5. Fitur Utama

### 5.1. Auth & RBAC
- Login email + password (bcrypt hash)
- 6 role dengan permission matrix
- Multi-tenant (kantor_cabang_id / faskes_id)
- Session cached via React.cache() untuk performance

### 5.2. Master Data
- Kantor cabang (CRUD + batch import Excel)
- User (CRUD + batch import + reset password + print slip kredensial)
- Faskes (CRUD + batch import 81 kolom + batch select + bulk action)
- Tarif acuan (2 mode: provinsi ceiling, rata-rata daerah dari 3+ RS)
- Tarif standar (75+ item baku kecelakaan kerja)
- Template PKS (upload + toggle active + view placeholders)

### 5.3. Pipeline Workflow
- 7 jenis × 6 tahap state machine
- Status: in_progress / cancelled / completed
- Cancel: PIC RS hanya di tahap diajukan/ditinjau; Super Admin kapan saja
- Takeover: PP ambil alih dari CM; CM takeover dari PIC RS saat drafting
- Notification otomatis per tahap transition
- Audit log semua aksi

### 5.4. Dokumen Pendukung
- 7 file wajib untuk pks_baru (surat pengantar, akta, izin, NPWP, SK PJ, dll)
- 2-3 file wajib untuk perpanjangan/adendum (varies per jenis)
- Upload ke Supabase Storage bucket `wpa-dokumen`
- Validation: pipeline tidak bisa advance kalau dokumen wajib belum lengkap

### 5.5. Drafting PKS
- Form 81 placeholder di-generate dari `pks-placeholders.ts`
- Grouped by kategori (Identitas Faskes, Bank, PJ, Tanggal, dll)
- **[BEFORE - BROKEN]** Generate via mammoth (lossy HTML) → edit via contentEditable → preview via window.print()
- **[AFTER MIGRATION]** Generate via Google Docs + Apps Script → edit native Google Docs → review via Suggestion Mode → export .docx via Google

### 5.6. Tarif Scanning + AI Review
- **Pattern scan (deterministic):** Excel tarif faskes → fuzzy match 3-layer (exact/contains/alias) vs Bank Tarif Standar + PKS lama → classify (≤5% WAJAR, 5-20% REVIEW, >20% TIDAK WAJAR)
- **AI second opinion (opsional):** call multi-provider AI (Gemini default, auto-rotate ke OpenAI/Zhipu/DeepSeek/Qwen kalau quota habis) → return narrative + list outliers
- 2 mode acuan: Provinsi ceiling (default) atau Rata-rata Daerah (survey 3+ RS terdekat)

### 5.7. Adendum Masal
- Super Admin publish template adendum masal (mis. "Penambahan Layanan Telemedicine")
- PIC RS semua faskes submit form placeholder (1 form per template)
- CM group review: ceklis multi → "Setuju Bareng" / "Tolak Bareng" untuk yang diceklis
- 1 aksi CM untuk 50+ faskes sekaligus
- Auto-generate PDF untuk TTD basah (per faskes)

### 5.8. Perpanjangan Auto-Clone
- Saat PIC RS ajukan perpanjangan dari PKS lama, function `cloneDataForPerpanjangan(oldData)`:
  - Field `auto_clone: true` (41 field: identitas, bank, PJ, pimpinan) → copy dari PKS lama
  - Field `auto_clone: false` (40 field: nomor PKS baru, tanggal, BA negosiasi) → reset ke null
  - Field `NOMOR_PKS_SEBELUMNYA_*` → diisi otomatis dari PKS lama
- PIC RS tinggal isi ~20% field sisanya

### 5.9. Dashboard Action-Oriented
- Setiap role lihat dashboard yang langsung kasih konteks: "Ini 5 PKS yang perlu Anda aksi hari ini"
- Stats card clickable → link ke halaman terkait
- "Aksi Hari Ini" section dengan button context-aware per tahap (Scan Tarif, Review Draft, Approve, Ambil Alih, dll)
- Faskes PKS berakhir section dengan countdown
- Quick action buttons

### 5.10. AI Provider System
- Multi-provider: Gemini (default), OpenAI, Zhipu, DeepSeek, Qwen, Claude
- Auto-rotate: kalau satu key quota habis, otomatis pakai key lain
- Auto-reset: key yang exhausted di-reset setelah 1 jam
- Keys disimpan di DB `wpa_ai_api_keys` per kantor cabang (multi-tenant)
- UI: AISettingsManager untuk CM/Kabid manage keys

### 5.11. Bot Receptionist
- Chatbot FAQ di login page
- Lazy-loaded (dynamic import) untuk performance
- Pakai AI provider dengan fallback rule-based kalau semua key exhausted

### 5.12. Dropping Pusat
- Kantor Pusat BPJS hapus faskes dari daftar PLKK cabang tertentu
- Pipeline 4 tahap: drafting_adendum → approval_kabid → review_legal_rs → tanda_tangan
- Tidak ada file dari PIC RS (CM yang handle)

### 5.13. Dokumen Operasional
- Surat menyurat post-PKS (SP, BA visitasi, sosialisasi)
- CM create dokumen via editor (sebelumnya TipTap, setelah migrasi: Google Docs embed)
- Send ke faskes
- History per faskes

### 5.14. Profile Self-Service
- Edit nama, phone, foto
- Ganti password (perlu old password)
- Upload foto (auto-resize client-side)

### 5.15. Print Slip Kredensial
- Print kredensial user (batch atau per-user)
- 2 format: slip kecil dan slip A4

---

## 6. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | Supabase (PostgreSQL + RLS + Storage) |
| Auth | Custom (email + bcrypt + JWT in HTTP-only cookie) |
| AI | Multi-provider (`src/lib/ai-provider.ts`) dengan auto-rotate |
| Dokumen PKS | **[BEFORE - BROKEN]** mammoth + TipTap + contentEditable + window.print → **[AFTER]** Google Docs + Apps Script |
| Hosting | Vercel (frontend + API) + Supabase (DB) + Google Workspace (PKS docs) |
| Cron | Vercel Cron (untuk mutasi processing) |

**Supabase project ID:** `hfhvsiuebrwrqmqzsroc`

---

## 7. Database Schema (High-Level)

24 tabel utama dengan prefix `wpa_`. Schema lengkap di `docs/04_DATABASE_SCHEMA.md`. Yang paling penting:

| Tabel | Isi |
|---|---|
| `wpa_kantor_cabang` | Master cabang BPJS (multi-tenant root) |
| `wpa_users` | User dengan role + kantor_cabang_id / faskes_id |
| `wpa_faskes` | Master fasilitas kesehatan + data_jsonb (81 placeholder values) |
| `wpa_pks` | PKS final (setelah TTD) + google_doc_id (setelah migrasi) |
| `wpa_pipeline` | State machine per pengajuan + google_doc_id (setelah migrasi) |
| `wpa_pks_template` | Template .docx + google_doc_template_id (setelah migrasi) |
| `wpa_pks_draft_versions` | Version tracking (max 4 versions) + google_doc_version_id |
| `wpa_tahap_config` | Konfigurasi tahap per jenis pipeline (urutan, SLA, handler) |
| `wpa_dokumen_pengajuan` | File wajib yang di-upload PIC RS |
| `wpa_tarif_acuan` | Tarif acuan per cabang (2 mode) |
| `wpa_tarif_standar` | 75+ item tarif baku kecelakaan kerja |
| `wpa_ai_api_keys` | Multi-provider AI keys dengan auto-rotate |
| `wpa_ai_tarif_review` | Log AI second opinion untuk kajian tarif |
| `wpa_adendum_masal_template` | Template adendum masal (published by SA) |
| `wpa_dokumen_operasional` | Surat menyurat post-PKS |
| `wpa_audit_logs` | Audit trail semua aksi |
| `wpa_notification` | In-app notifications |

**Storage buckets:** `wpa-templates`, `wpa-dokumen`, `wpa-dokumen-operasional`, `wpa-pks-final`, `wpa-avatars`, `wpa-tarif`, `wpa-adendum-masal`.

---

## 8. PKS Placeholders (81 field)

Sumber: `src/lib/pks-placeholders.ts` (extract dari `PKS_PLKK_2026_TEMPLATE_BERSIH.docx`).

Format: `{{NAMA_KEY}}` (UPPERCASE, underscore, tanpa spasi di dalam braces).

Dikelompokkan dalam 9 kategori:

| Kategori | Jumlah | auto_clone |
|---|---|---|
| Identitas Faskes | 10 | ✅ true |
| Identitas Kantor BPJS | 8 | ✅ true |
| Nomor & Tanggal PKS | 7 | ❌ false |
| PKS Sebelumnya | 4 | ❌ false (diisi saat perpanjangan) |
| Bank | 4 | ✅ true |
| Tarif | 6 | ❌ false |
| BA Negosiasi | 11 | ❌ false |
| Rekonsiliasi | 5 | ❌ false |
| Informasi Kelengkapan | 8 | ❌ false |
| PIC & Kontak | 13 | ✅ true |
| Pakta & Lainnya | 5 | mixed |

**Total:** 81 placeholder. 41 auto-clone (~51%), 40 reset (~49%).

Daftar lengkap ada di `docs/05_PLACEHOLDERS.md`.

---

## 9. API Endpoints (50+)

Inventarisasi lengkap di `docs/06_API_ENDPOINTS.md`. Highlights:

- **Auth:** `/api/auth/login`, `/api/auth/logout`, `/api/health`, `/api/setup`
- **Profile:** 4 endpoints untuk self-service
- **Kantor:** 7 endpoints (CRUD + batch import + template)
- **Users:** 4 endpoints (CRUD + batch import + template)
- **Faskes:** 3 endpoints (template + batch import + multi-attach)
- **Pipeline:** 5 endpoints (list, detail, transition, takeover, takeover-toggle)
- **Pengajuan:** 5 endpoints (create, draft, submit, dokumen list, dokumen upload **MISSING**)
- **PKS Baru:** 1 endpoint (CM onboarding faskes)
- **Perpanjangan:** 1 endpoint (auto-clone)
- **Adendum:** 1 endpoint (create)
- **Adendum Masal:** 5 endpoints (list-templates, create, list-pending, group-action, detail)
- **Drafting:** 8 endpoints (start, generate, save-version, versions, version detail, review, takeover, save)
- **Template:** 4 endpoints (list, detail, toggle, upload **MISSING**)
- **Tarif:** 11 endpoints (template, batch-import, acuan CRUD, scan, ai-review, comparison, konversi, faskes list)
- **AI Keys:** 4 endpoints (CRUD via single endpoint with different methods)
- **Dokumen Operasional:** 6 endpoints
- **Dropping Pusat:** 2 endpoints
- **Mutasi:** 3 endpoints
- **Print:** 3 endpoints (slip-kredensial, slip-a4, kartu-mutasi)
- **Cron:** 1 endpoint (mutasi processor)
- **Bot:** 1 endpoint (chat)

**Setelah migrasi Google Docs, tambah 4 endpoints baru:**
- `/api/drafting/generate-google-doc` (POST) — call Apps Script
- `/api/drafting/share` (POST) — share Google Doc ke PIC RS + CM
- `/api/drafting/sync-status` (GET) — cek pending suggestions
- `/api/drafting/download-docx` (GET) — proxy download .docx dari Google

---

## 10. Known Issues (Critical)

Berdasarkan audit menyeluruh codebase. Detail di `docs/09_KNOWN_ISSUES.md`.

### 🔴 Critical (blocking)

1. **`/api/template/upload` MISSING** — Super Admin tidak bisa upload template via UI. Workaround: manual SQL + Supabase Storage.
2. **`/api/pengajuan-dokumen/upload` MISSING** — PIC RS tidak bisa upload dokumen wajib. **Pipeline pks_baru/perpanjangan/adendum broken end-to-end.**
3. **`DocumentEditor.tsx` wired to wrong API** — Tombol "Rapihkan Format" dead code (404 ke tabel salah).
4. **`mammoth` lossy conversion** — Template .docx → HTML membuang ~70% format (header, footer, watermark, tabel merged cells, page numbers, letterhead).
5. **`CMTakeoverModal.tsx` system_edit = plain Textarea** — Label bilang TipTap, reality textarea HTML mentah.

### 🟠 Major

6. TipTap missing Table extension (tabel hilang saat buka editor)
7. `contentEditable` + `dangerouslySetInnerHTML` brittle (browser normalize inkonsisten)
8. Placeholder substitution case-sensitive + no HTML escape (XSS risk)
9. Adendum masal PDF tidak pernah di-generate (notification bilang ready, kolom `pdf_generated_url` tidak pernah di-write)
10. `pdf_generated_url` kolom tidak pernah di-write (confirmed via grep)

### 🟡 Minor

11. `admin_kantor` role deprecated tapi masih ada di enum DB
12. Zod v4 breaking changes (sudah di-fix)
13. Login redirect stuck on /login (workaround: manual refresh)
14. Performance: `getSession()` tidak di-cache (sudah di-fix dengan React.cache)
15. BotReceptionist heavy bundle (sudah di-fix dengan dynamic import)
16. `KantorDetailManager.tsx` missing batch deactivate (TODO comment)

---

## 11. Rencana Migrasi: Google Docs + Apps Script

**Goal:** Replace lapisan rendering/edit/print dokumen PKS yang broken dengan Google Docs + Apps Script.

**Effort:** 5-6 hari kerja. **Cost:** $0.

**Detail lengkap di `docs/10_MIGRATION_PLAN.md`.** Summary:

### Arsitektur Setelah Migrasi

```
Next.js (Vercel) ──HTTP──> Apps Script Web App ──> Google Docs
  - Workflow                      (Code.gs)             - Template
  - RBAC                                                - Generated docs
  - Audit                                               - Version history
  - Notification                                        - Suggestion Mode
  - Dashboard                                           - Comments
  - Form placeholder                                    - .docx export
  - Tarif scan                                          - PDF export
  - Adendum masal
```

### Alur Kerja Setelah Migrasi

1. PIC RS isi form 81 placeholder di Next.js → klik "Generate ke Google Docs"
2. Next.js call Apps Script (POST) dengan payload `{ jenis_pipeline, values, share_with }`
3. Apps Script:
   - Clone template Google Docs
   - `body.replaceText({{KEY}}, value)` untuk 81 placeholder
   - Save as new Google Doc
   - Auto-share ke PIC RS (editor) + CM (editor)
   - Return `{ doc_id, edit_url }`
4. Next.js save `google_doc_id` + `google_doc_url` ke DB
5. PIC RS klik link → Google Docs terbuka → edit native (WYSIWYG real)
6. PIC RS klik "Submit untuk Review" → advance tahap
7. CM buka link → ubah mode "Suggesting" → koreksi inline + comments
8. CM klik "Approve" di Next.js → advance tahap (gagal kalau masih ada pending suggestions)
9. Kabid approve → Legal RS review → Kabid TTD
10. Kabid klik "Download .docx" → Google export URL → .docx download

### Tahapan Migrasi (5-6 hari)

| Tahap | Durasi | Pihak | Output |
|---|---|---|---|
| 0. Persiapan & validasi | 30 menit | User | Compliance OK, akun Google, 6 template .docx |
| 1. Setup Google Cloud | 20 menit | User | Client ID + Secret, Project ID |
| 2. Deploy Apps Script | 1 jam | User | Web App URL |
| 3. Setup template Google Docs | 2 jam | User | 6 template dengan placeholder |
| 4. Migrasi code | 2-3 hari | AI/dev | Code siap deploy |
| 5. Deploy & test | 1 hari | User + dev | Aplikasi siap pakai |
| 6. Onboarding user | 1 hari | User | User trained |

### Yang Berubah

**HAPUS:**
- `DocumentEditor.tsx` (TipTap)
- `mammoth` dependency
- `@tiptap/*` dependencies
- `docx` dependency (tidak pernah dipakai)
- `/api/drafting/generate/route.ts` (mammoth-based)
- `/api/dokumen-operasional/preview/route.ts`

**UBAH:**
- `DraftingPKSView.tsx` — hapus contentEditable + PreviewModal, tambah tombol Generate Google Docs + iframe embed
- `CMReviewDraft.tsx` — hapus HTML diff, ganti dengan embed Google Docs + tombol "Buka untuk Suggest Changes"
- `CMTakeoverModal.tsx` — hapus textarea HTML, ganti "Buka di Google Docs"
- `PipelineDetailView.tsx` — ganti window.print() dengan "Download .docx" link
- `DokumenOperasionalView.tsx` — ganti TipTap dengan embed Google Docs

**TAMBAH:**
- 4 Next.js API endpoints (`/api/drafting/generate-google-doc`, `share`, `sync-status`, `download-docx`)
- Apps Script `Code.gs` (siap di `apps_script/Code.gs`)
- Migration SQL (`sql/11_migration_to_google_docs.sql`)
- Kolom DB: `google_doc_id`, `google_doc_url`, `google_doc_shared_with`, `google_doc_version_id`, `google_doc_template_id`

### Yang TIDAK Berubah

- 81 placeholder taxonomy
- Pipeline state machine + RBAC + audit + notification
- Auto-clone perpanjangan
- Adendum masal group-review UX
- Tarif scanning + AI review
- Dashboard action-oriented (6 role)
- Bot receptionist
- Profile self-service
- Print slip kredensial
- Batch import (kantor, user, faskes, tarif)

---

## 12. Acceptance Criteria (post-migration)

### 12.1. Functional

- [ ] PIC RS bisa upload 7 dokumen wajib via `/api/pengajuan-dokumen/upload`
- [ ] Super Admin bisa upload template via `/api/template/upload`
- [ ] PIC RS bisa generate Google Doc dari form placeholder → Google Doc terbentuk dengan placeholder ter-replace
- [ ] PIC RS + CM ter-auto-share sebagai editor saat generate
- [ ] CM bisa buka Google Doc, nyalakan Suggesting Mode, koreksi inline, add comments
- [ ] Pipeline tidak bisa advance kalau masih ada pending suggestions (verified via `/api/drafting/sync-status`)
- [ ] CM bisa takeover draft (editor mode atau file upload mode)
- [ ] Kabid bisa download .docx final via Google export URL
- [ ] Kabid bisa upload signed PDF (hasil scan TTD basah)
- [ ] Adendum masal bisa generate Google Doc per faskes (bulk)
- [ ] Perpanjangan auto-clone data tetap jalan (80% field ter-copy)
- [ ] Tarif scan + AI review tetap jalan
- [ ] Audit log semua aksi tercatat

### 12.2. Non-Functional

- [ ] Page load dashboard < 2 detik (cached session)
- [ ] Generate Google Doc < 10 detik
- [ ] Sync-status check < 3 detik
- [ ] 99.5% uptime (Vercel SLA)
- [ ] Mobile responsive (sidebar collapsible, sheet drawer)
- [ ] All 6 role dashboards render correctly
- [ ] No console errors di production

### 12.3. User Acceptance

- [ ] 1 PIC RS test end-to-end pks_baru → completed
- [ ] 1 PIC RS test perpanjangan dengan auto-clone
- [ ] 1 CM test group review adendum masal (3 faskes)
- [ ] 1 Kabid test approve + TTD + download .docx
- [ ] 1 Legal RS test review draft
- [ ] Super Admin test upload template + manage users

---

## 13. Roadmap (post-migration)

1. **Fase 6 — Pembinaan & Sosialisasi** (PP lapor faskes → CM decision → SP/visitasi/sosialisasi)
2. **PIC RS self-service editing faskes data** (sekarang harus via CM)
3. **Mobile PWA optimization** (sekarang responsive tapi belum PWA)
4. **Laporan & analytics** untuk Kabid (sekarang masih basic)
5. **Integrasi email notification** dengan SMTP BPJS (sekarang via Supabase function)
6. **Multi-cabang CM** (sekarang 1 CM = 1 cabang)
7. **Server-side PDF generation** via OAuth2 service account (untuk automated flows)
8. **Protected ranges** di Google Docs (untuk batasi PIC RS edit area tertentu)

---

## 14. Referensi Paket Backup

Paket backup ini berisi:

```
mitra-plkk-backup/
├── README.md                                  ← Index paket
├── PRD_Mitra_PLKK.md                          ← File ini
├── apps_script/
│   └── Code.gs                                ← Ready-to-paste Apps Script (~400 baris)
├── docs/
│   ├── 01_PRODUCT_OVERVIEW.md
│   ├── 02_USER_ROLES.md
│   ├── 03_PIPELINE_FLOWS.md
│   ├── 04_DATABASE_SCHEMA.md
│   ├── 05_PLACEHOLDERS.md                     ← 81 placeholder detail
│   ├── 06_API_ENDPOINTS.md                    ← 50+ endpoints inventory
│   ├── 07_COMPONENTS_INVENTORY.md
│   ├── 08_AI_PROVIDER_SYSTEM.md
│   ├── 09_KNOWN_ISSUES.md                     ← Critical bugs list
│   └── 10_MIGRATION_PLAN.md                   ← Step-by-step migrasi
├── sql/
│   └── 11_migration_to_google_docs.sql        ← Alter tabel untuk Google Docs
├── nextjs_api_stubs/
│   └── generate_google_doc.ts                 ← Stub Next.js API route
└── env/
    └── .env.example                           ← Template env vars
```

---

## 15. Catatan untuk AI/Developer Pengganti

1. **Baca urut:** `01_PRODUCT_OVERVIEW` → `02_USER_ROLES` → `03_PIPELINE_FLOWS` → `04_DATABASE_SCHEMA` → `09_KNOWN_ISSUES` → `10_MIGRATION_PLAN`
2. **Jangan percaya worklog 100%** — selalu verify dengan baca file sebenarnya. Beberapa fitur yang dulu jalan sekarang broken (regression diam-diam).
3. **Migrasi Google Docs adalah prioritas #1.** Tanpa itu, semua fitur drafting dokumen PKS tidak bisa dipakai production.
4. **Test end-to-end sebelum claim "done".** Build success ≠ fitur jalan. Buka browser, coba flow sebenarnya.
5. **Apps Script `Code.gs` siap pakai** — tinggal paste ke Apps Script editor, ganti `TEMPLATE_IDS` + `DOC_OWNER_EMAIL` + `AUTH_SECRET`, deploy.
6. **Migration SQL backward compatible** — kolom lama (`content_html`) di-rename jadi `content_html_deprecated` (tidak di-drop). Bisa rollback kalau perlu.
7. **Env vars yang perlu di-set di Vercel:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPS_SCRIPT_WEB_APP_URL`, `APPS_SCRIPT_SECRET`, `GOOGLE_DOC_OWNER_EMAIL`, `MIGRATION_GOOGLE_DOCS_ENABLED=true`.
8. **Source code Next.js lengkap** tidak disertakan di paket ini (ada di repo GitHub user). Yang disertakan: stub API baru (`nextjs_api_stubs/`) + 1 komponen reference. Kalau butuh source code komponen tertentu, minta ke user untuk copy-paste file spesifik dari `src/components/wpa/<nama>.tsx`.

---

**Generated:** 17 Juli 2026
**Source agent:** Super Z (Claude Code)
**Backup purpose:** Handover untuk AI/developer pengganti untuk meneruskan proyek Mitra PLKK, terutama bagian migrasi ke Google Docs + Apps Script.
