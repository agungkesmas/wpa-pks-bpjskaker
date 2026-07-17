# Mitra PLKK — Backup Package untuk Handover AI

> **Tanggal backup:** 17 Juli 2026
> **Asal:** Proyek Next.js di `/home/z/my-project/` (akses via Claude Code)
> **Tujuan:** Paket lengkap untuk diserahkan ke AI/developer lain agar bisa melanjutkan proyek, terutama bagian **migrasi ke Google Docs + Apps Script**.

---

## Konteks Singkat

**Mitra PLKK** adalah aplikasi web untuk mengelola siklus hidup PKS (Perjanjian Kerja Sama) antara BPJS Ketenagakerjaan dan Faskes Pusat Layanan Kecakapan Kerja (PLKK). Aplikasi dibangun dengan Next.js 16 + Supabase, dan sudah mencapai ~60% completion. Lapisan workflow (pipeline, RBAC, audit, notifikasi) solid. Tapi **lapisan rendering/edit dokumen PKS (yang paling kritis) broken dari akar** — memakai `mammoth` (lossy HTML conversion) + `contentEditable` + `window.print()` yang tidak akan pernah bisa memenuhi standar legal BPJS.

**Keputusan user:** Migrasi lapisan dokumen ke **Google Docs + Apps Script** (lihat `docs/10_MIGRATION_PLAN.md`). Sisa aplikasi (workflow, dashboard, RBAC) tetap di Next.js.

---

## Struktur Folder

```
mitra-plkk-backup/
├── README.md                                  ← File ini (INDEX)
├── apps_script/
│   └── Code.gs                                ← Ready-to-paste Apps Script (~400 baris)
├── docs/
│   ├── 01_PRODUCT_OVERVIEW.md                 ← Problem, target user, scope
│   ├── 02_USER_ROLES.md                       ← 6 role + permission matrix
│   ├── 03_PIPELINE_FLOWS.md                   ← 6 tahap × 7 jenis pengajuan
│   ├── 04_DATABASE_SCHEMA.md                  ← Consolidated Supabase schema
│   ├── 05_PLACEHOLDERS.md                     ← 81 placeholder PKS
│   ├── 06_API_ENDPOINTS.md                    ← Full API inventory (50+ endpoints)
│   ├── 07_COMPONENTS_INVENTORY.md             ← Komponen React yang sudah dibangun
│   ├── 08_AI_PROVIDER_SYSTEM.md               ← Multi-provider AI (Gemini/OpenAI/...)
│   ├── 09_KNOWN_ISSUES.md                     ← Bug + regression yang harus di-fix
│   └── 10_MIGRATION_PLAN.md                   ← Step-by-step migrasi ke Google Docs
├── sql/
│   ├── 00_master_schema_consolidated.sql      ← Gabungan semua tabel penting
│   └── 11_migration_to_google_docs.sql        ← Alter tabel untuk google_doc_id/url
├── nextjs_api_stubs/
│   └── generate_google_doc.ts                 ← Stub Next.js API route
├── env/
│   └── .env.example                           ← Template env vars
└── PRD_Mitra_PLKK.pdf                         ← PRD lengkap (printable, untuk stakeholder)
```

---

## Cara Pakai Paket Ini

### Untuk AI yang akan meneruskan proyek:

1. **Baca urut:** `01_PRODUCT_OVERVIEW.md` → `02_USER_ROLES.md` → `03_PIPELINE_FLOWS.md` → `04_DATABASE_SCHEMA.md` → `09_KNOWN_ISSUES.md` → `10_MIGRATION_PLAN.md`
2. **Lihat kode siap pakai:** `apps_script/Code.gs` (Apps Script backend)
3. **Untuk konteks API:** `06_API_ENDPOINTS.md` (existing) + `nextjs_api_stubs/generate_google_doc.ts` (baru)
4. **PRD PDF** = dokumen formal untuk stakeholder/klien, bukan untuk AI konsumsi (markdown lebih efisien)

### Untuk developer manusia:

1. Mulai dari `PRD_Mitra_PLKK.pdf` untuk gambaran besar
2. Ikuti `10_MIGRATION_PLAN.md` step-by-step (5-6 hari kerja)
3. Setelah deploy Apps Script, copy Web App URL ke `.env`
4. Run `sql/11_migration_to_google_docs.sql` di Supabase dashboard
5. Pull latest code, set env vars, deploy ke Vercel

---

## Tech Stack Singkat

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | Supabase (PostgreSQL + RLS + Storage) |
| Auth | Custom (email+password hash) — bukan Supabase Auth |
| AI | Multi-provider via `src/lib/ai-provider.ts` (Gemini/OpenAI/Zhipu/DeepSeek/Qwen + auto-rotate) |
| Dokumen PKS | **BEFORE:** mammoth + TipTap + contentEditable (broken) → **AFTER:** Google Docs + Apps Script |
| Hosting | Vercel (frontend) + Supabase (DB) + Google Workspace (PKS docs) |

---

## Quick Facts

- **6 role:** super_admin, case_manager (CM), kepala_bidang (Kabid), pic_rs (PIC RS), legal_rs, penata_pelayanan (PP)
- **7 jenis pengajuan:** pks_baru, perpanjangan, adendum_harga, adendum_layanan_baru, adendum_dropping, adendum_masal, perubahan_data
- **6 tahap pipeline:** Pengajuan → Peninjauan & Kajian Tarif → Kredensialing → Drafting → Approval & Review → Tanda Tangan
- **81 placeholder PKS** dikelompokkan dalam 9 kategori (lihat `docs/05_PLACEHOLDERS.md`)
- **50+ API endpoints** (lihat `docs/06_API_ENDPOINTS.md`)
- **34 faskes** sudah di-migrate dari Google Sheets
- **Supabase project ID:** `hfhvsiuebrwrqmqzsroc`

---

## Yang Tidak Disertakan di Paket Ini

Untuk hemat ukuran, beberapa hal tidak di-include di paket backup ini:

- **Source code Next.js lengkap** — ada di repo GitHub user (akses via Claude Code di environment ini). Yang disertakan: stub API baru + 1 komponen reference (`nextjs_api_stubs/`)
- **Screenshot UI** — ada di `/home/z/my-project/download/*.png` (file `audit_*.png`, `minim_klik_*.png`, dll)
- **File .docx template PKS asli** — punya user di Google Drive
- **Service account credentials / OAuth secrets** — user harus generate sendiri (lihat `docs/10_MIGRATION_PLAN.md` Tahap 1)

Kalau AI perlu source code lengkap komponen tertentu, minta ke user untuk copy-paste file spesifik dari `/home/z/my-project/src/components/wpa/<nama>.tsx`.

---

## Pertanyaan yang Sering Muncul

**Q: Kenapa tidak pakai docx-templater (Node.js library) saja?**
A: Bisa saja, tapi Google Docs + Apps Script solve 4 masalah sekaligus (WYSIWYG + collab + version history + export fidelity) dalam 1 produk. docx-templater hanya solve substitusi placeholder, tanpa editor in-browser. Effort Google Docs = 3-5 hari, docx-templater = 2-3 minggu. Detail di `docs/10_MIGRATION_PLAN.md`.

**Q: Bisakah tetap pakai lapisan dokumentasi yang sekarang (mammoth + TipTap)?**
A: **Tidak.** Audit menemukan: 2 endpoint critical missing (`/api/template/upload`, `/api/pengajuan-dokumen/upload`), TipTap Table extension tidak didaftarkan, CM takeover modal pakai textarea HTML biasa, `window.print()` untuk "Print Final" tidak menghasilkan .docx asli. Lihat `docs/09_KNOWN_ISSUES.md` untuk daftar lengkap.

**Q: Kenapa tidak pakai Office.js Add-in?**
A: Effort 4-6 minggu, butuh M365 tenant, kurva belajar tinggi. Cocok kalau volume >500 PKS/tahun dan tim dev menguasai Office.js. Untuk kasus Mitra PLKK, Google Docs + Apps Script adalah sweet spot.

**Q: Data sovereignty — amankah simpan PKS di Google?**
A: PKS = cooperation agreement antar-lembaga, BUKAN data medis pasien. Tidak ada PII pasien di PKS. Biasanya acceptable untuk disimpan di Google Workspace. Tapi final keputusan ada di tim legal/kepatuhan BPJS. Lihat `docs/10_MIGRATION_PLAN.md` Tahap 0.

---

## Kontak & Konfigurasi

- **GitHub repo:** punya user (akses via Claude Code di env ini)
- **Supabase project:** `hfhvsiuebrwrqmqzsroc` (akses via Supabase dashboard)
- **Vercel deployment:** punya user
- **Document owner email (Google):** `plkk.bpjs@gmail.com` (usulan — user bebas ganti)

---

**Generated:** 17 Juli 2026
**Source agent:** Super Z (Claude Code)
**Backup purpose:** Handover untuk AI/developer pengganti
