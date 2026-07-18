# 10 — Migration Plan: dari mammoth/TipTap ke Google Docs + Apps Script

> **Goal:** Replace lapisan rendering/edit/print dokumen PKS yang broken (mammoth + contentEditable + window.print) dengan Google Docs + Apps Script. Sisa aplikasi (workflow, RBAC, dashboard) tetap utuh.
>
> **Effort:** 5-6 hari kerja
> **Risk:** Rendah. 60% codebase tetap utuh. Yang berubah hanya lapisan dokumen.
> **Cost:** $0 (Google Workspace atau @gmail.com sudah cukup)

---

## TL;DR — Alur Setelah Migrasi

```
PIC RS klik "Generate ke Google Docs"
    ↓
Next.js call Apps Script (POST) dengan { jenis_pipeline, values: 81 placeholder }
    ↓
Apps Script:
  1. Clone template Google Docs
  2. body.replaceText({{KEY}}, value) untuk 81 placeholder
  3. Save as new Google Doc
  4. Auto-share ke PIC RS (editor) + CM (editor)
  5. Return { doc_id, edit_url }
    ↓
Next.js save google_doc_id + google_doc_url ke wpa_pks_draft_versions
    ↓
PIC RS klik edit_url → Google Docs terbuka → edit langsung (WYSIWYG native)
    ↓
PIC RS klik "Submit untuk Review" → advance tahap ke CM review
    ↓
CM buka edit_url → ubah mode "Suggesting" (ikon pensil kanan atas)
    ↓
CM koreksi inline + add comments
    ↓
CM klik "Approve" di Next.js → advance tahap ke approval_kabid
   ATAU
CM klik "Return with catatan" → set catatan_cm, balik ke PIC RS
   ATAU
CM klik "Takeover" → Apps Script promote CM jadi editor langsung
    ↓
... lanjut ke Kabid approve + Legal RS review + TTD basah
    ↓
Kabid klik "Download .docx" → redirect ke Google export URL → .docx download
    ↓
Print, TTD basah, scan upload → done
```

---

## Tahap 0 — Persiapan & Validasi (Anda, 30 menit)

### 0.1. Cek compliance
- [ ] Konfirmasi PKS BPJS boleh disimpan di Google Drive (bukan data medis pasien, jadi biasanya OK)
- [ ] Tanya tim legal/kepatuhan BPJS kalau ada keberatan
- [ ] Kalau OK → lanjut. Kalau tidak → fallback ke Solusi B (tracker murni, lapisan dokumen offline Word)

### 0.2. Siapkan akun Google "document owner"
- [ ] Buat 1 akun Gmail khusus (mis. `plkk.bpjs@gmail.com`) ATAU pakai akun Workspace existing
- [ ] **Jangan pakai akun pribadi** — kalau resign/berubah, dokumentasi ikut
- [ ] Akun ini = "rumah" semua PKS. PIC RS dan CM lain di-share sebagai editor

### 0.3. Siapkan template PKS BPJS (.docx asli)
- [ ] Cari file `.docx` template PKS BPJS yang resmi (yang sudah dipakai selama ini)
- [ ] Upload ke Google Drive akun document owner → klik kanan → "Open with → Google Docs" (auto-convert)
- [ ] Rename jadi `TEMPLATE - PKS Baru`
- [ ] Lakukan hal sama untuk: `TEMPLATE - Perpanjangan`, `TEMPLATE - Adendum Harga`, `TEMPLATE - Adendum Layanan Baru`, `TEMPLATE - Perubahan Data`, `TEMPLATE - Adendum Masal`

**Output Tahap 0:** 1 akun Google siap + 6 template di Google Drive

---

## Tahap 1 — Setup Google Cloud (Anda, 20 menit)

### 1.1. Buat Google Cloud Project
1. Buka https://console.cloud.google.com/ (login pakai akun document owner)
2. Klik project dropdown (atas) → "New Project"
3. Nama: `Mitra-PLKK-Prod`
4. Klik "Create"

### 1.2. Enable 3 API
1. Menu "APIs & Services" → "Library"
2. Search & enable satu-satu:
   - `Google Docs API` → Enable
   - `Google Drive API` → Enable
   - `Apps Script API` → Enable

### 1.3. Buat OAuth 2.0 Credentials
1. Menu "APIs & Services" → "Credentials"
2. "Create Credentials" → "OAuth client ID"
3. Application type: `Web application`
4. Name: `Mitra PLKK`
5. Authorized redirect URIs: tambah `https://mitra-plkk.vercel.app/api/google/callback` (atau URL produksi Anda)
6. Klik "Create" → simpan `Client ID` dan `Client Secret`

### 1.4. Configure OAuth Consent Screen
1. Menu "OAuth consent screen"
2. User type: `External` (atau `Internal` kalau Workspace)
3. App name: `Mitra PLKK`, support email: isi
4. Scopes: tambahkan `docs`, `drive`, `script.projects`
5. Test users: tambahkan email document owner + email testing

**Output Tahap 1:** `Client ID`, `Client Secret`, Project ID — simpan untuk env vars

---

## Tahap 2 — Deploy Apps Script (Anda, 1 jam)

### 2.1. Buat Apps Script Project
1. Buka https://script.google.com (login pakai document owner)
2. "New Project" → rename jadi `Mitra PLKK Apps Script`

### 2.2. Paste Kode
1. Buka file `apps_script/Code.gs` dari paket backup ini
2. Copy seluruh isi, paste ke editor Apps Script (timpa Code.gs default)
3. **Edit bagian `TEMPLATE_IDS`** di atas file — ganti placeholder dengan ID template Google Docs Anda:
   - `pks_baru`: ID template `TEMPLATE - PKS Baru`
   - `perpanjangan`: ID template `TEMPLATE - Perpanjangan`
   - dst.
   
   Cara ambil ID: buka template Google Docs → lihat URL → ambil bagian setelah `/d/` sampai `/edit`. Contoh:
   `https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit` → ID = `1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890`

4. Edit `DOC_OWNER_EMAIL` → email document owner Anda
5. Edit `OUTPUT_FOLDER_ID` (opsional) → ID folder Google Drive tempat dokumen disimpan. Kosongkan = root folder
6. Edit `AUTH_SECRET` → random string 32 char (untuk HMAC verification, opsional tapi recommended)

7. Save (Ctrl+S)

### 2.3. Enable Advanced Services
1. Di Apps Script editor: Services (sidebar kiri) → "+ Add a service"
2. Tambahkan: `Drive API` (v2 — penting untuk Comments API)
3. Tambahkan: `Google Docs API` (v1 — untuk operasi advanced)

### 2.4. Hubungkan dengan Project Cloud
1. Di Apps Script editor: klik icon ⚙️ (Project Settings)
2. Klik "Change project" → pilih `Mitra-PLKK-Prod` (yang dibuat di Tahap 1)
3. Save

### 2.5. Deploy sebagai Web App
1. Klik "Deploy" → "New Deployment"
2. Type: `Web app`
3. Execute as: `Me` (document owner)
4. Who has access: `Anyone` (atau "Anyone with Google account")
5. Klik "Deploy"
6. Authorize permissions (popup Google — klik "Advanced" → "Go to Mitra PLKK" → "Allow")
7. Copy **Web App URL** (format: `https://script.google.com/macros/s/XXX/exec`)

### 2.6. Test Web App
1. Buka Web App URL di browser → harus return JSON: `{"ok":true,"service":"mitra-plkk-apps-script","time":"..."}`
2. Test POST dengan curl:
   ```bash
   curl -X POST '<WEB_APP_URL>' \
     -H 'Content-Type: application/json' \
     -d '{"action":"get_doc_info","doc_id":"test"}'
   ```
   Should return `{"ok":false,"error":"File with id test does not exist"}` — ini benar (test dokumen tidak ada).

**Output Tahap 2:** `Web App URL` — simpan untuk env vars

---

## Tahap 3 — Setup Template Google Docs (Anda, 2 jam)

### 3.1. Tandai placeholder di template

Buka setiap template Google Docs, ganti nilai-nilai yang berubah dengan placeholder format `{{NAMA_KEY}}`. Ambil dari 81 placeholder di `docs/05_PLACEHOLDERS.md`.

Contoh untuk `TEMPLATE - PKS Baru`:

```
                            PERJANJIAN KERJA SAMA
              ANTARA PT ASURANSI SOSIAL TENAGA KERJA (BPJS KETENAGAKERJAAN)
                    DENGAN {{NAMA_FASKES}}

Pada hari ini, {{HARI_TANDA_TANGAN}} tanggal {{TANGGAL_TANDA_TANGAN}} bulan ...
bertempat di {{KOTA_TANDA_TANGAN}}, kami yang bertanda tangan di bawah ini:

I.    Nama    : {{NAMA_KEPALA_KANTOR_CABANG}}
      Jabatan : Kepala Kantor Cabang {{NAMA_KANTOR_CABANG}}
      Alamat  : {{ALAMAT_KANTOR_CABANG}}
      ...
```

### 3.2. Aturan penulisan placeholder

1. **Format:** `{{` + `KEY_UPPERCASE` + `}}` (tanpa spasi di dalam)
2. **Case-sensitive:** harus UPPERCASE. `{{nama_faskes}}` (lowercase) tidak akan ke-replace.
3. **Multiple occurrence OK:** satu placeholder bisa muncul beberapa kali di template.
4. **Boleh di table cell, header, footer:** Apps Script `body.replaceText()` handle semua.

### 3.3. Lakukan hal sama untuk semua 6 template

- [ ] `TEMPLATE - PKS Baru` — 81 placeholder
- [ ] `TEMPLATE - Perpanjangan` — 81 placeholder (beberapa field akan terisi dari PKS lama)
- [ ] `TEMPLATE - Adendum Harga` — subset placeholder + field khusus adendum
- [ ] `TEMPLATE - Adendum Layanan Baru` — subset + field layanan baru
- [ ] `TEMPLATE - Perubahan Data` — subset + field perubahan
- [ ] `TEMPLATE - Adendum Masal` — subset (varies per template)

### 3.4. Catat Template IDs
- [ ] Untuk setiap template, copy ID dari URL (bagian setelah `/d/` sampai `/edit`)
- [ ] Pastikan ID yang diisi di `Code.gs` (Tahap 2.2) benar

**Output Tahap 3:** 6 template siap pakai dengan placeholder

---

## Tahap 4 — Migrasi Code (Saya / AI pengganti, 2-3 hari)

### 4.1. Set environment variables di Vercel

```
GOOGLE_CLIENT_ID=<from Tahap 1.3>
GOOGLE_CLIENT_SECRET=<from Tahap 1.3>
APPS_SCRIPT_WEB_APP_URL=<from Tahap 2.5>
GOOGLE_DOC_OWNER_EMAIL=plkk.bpjs@gmail.com
APPS_SCRIPT_SECRET=<AUTH_SECRET yang di-set di Code.gs Tahap 2.2>
```

### 4.2. Run migration SQL

Jalankan `sql/11_migration_to_google_docs.sql` di Supabase dashboard. Script ini:
- Tambah kolom `google_doc_id`, `google_doc_url`, `google_doc_shared_with` ke `wpa_pks`
- Tambah kolom yang sama ke `wpa_pipeline`
- Tambah `google_doc_version_id` ke `wpa_pks_draft_versions`
- Tambah `google_doc_template_id` ke `wpa_pks_template`
- Tambah `google_doc_id`, `google_doc_url` ke `wpa_dokumen_operasional`
- Backup `content_html` ke `content_html_deprecated` (tidak drop, untuk rollback)

### 4.3. Buat endpoint baru

Lihat stub di `nextjs_api_stubs/generate_google_doc.ts`. Endpoint yang perlu dibuat:

#### `/api/drafting/generate-google-doc` (POST)
- Body: `{ pipeline_id, values: {...}, doc_name? }`
- Logic:
  1. Get template_id dari `wpa_pipeline.template_id` → lookup `wpa_pks_template.google_doc_template_id`
  2. Ambil `PIC RS email` + `CM email` dari DB (untuk auto-share)
  3. Call Apps Script: `POST APPS_SCRIPT_WEB_APP_URL` dengan body:
     ```json
     {
       "action": "generate_doc",
       "jenis_pipeline": "pks_baru",
       "values": { "NAMA_FASKES": "...", ... },
       "doc_name": "PKS - RS Mitra Keluarga - 2026",
       "share_with": [
         { "email": "pic.rs@example.com", "role": "writer" },
         { "email": "cm.cirebon@bpjs.go.id", "role": "writer" }
       ]
     }
     ```
  4. Receive `{ ok: true, doc_id, edit_url, replaced, remaining_placeholders, shared }`
  5. Update `wpa_pks_draft_versions` SET `google_doc_version_id = doc_id`, `google_doc_url = edit_url`
  6. Update `wpa_pks` SET `google_doc_id = doc_id`, `google_doc_url = edit_url`
  7. Update `wpa_pipeline` SET `google_doc_id = doc_id`, `google_doc_url = edit_url`, `google_doc_shared_with = [...]`
  8. Return `{ ok: true, edit_url, remaining_placeholders }` ke client

#### `/api/drafting/share` (POST)
- Body: `{ pipeline_id, share_with: [{email, role}] }`
- Call Apps Script dengan action `share_doc`
- Update `wpa_pipeline.google_doc_shared_with`

#### `/api/drafting/sync-status` (GET)
- Query: `?pipeline_id=xxx`
- Call Apps Script dengan action `list_pending_suggestions`
- Return `{ ok: true, pending_count, items }` — pipeline tidak boleh advance kalau `pending_count > 0`

#### `/api/drafting/download-docx` (GET)
- Query: `?pipeline_id=xxx`
- Return redirect ke Google Docs export URL: `https://docs.google.com/document/d/{doc_id}/export?format=docx`
- Note: URL ini butuh auth Google. Untuk server-side proxy, pakai OAuth2 atau service account (advanced, butuh setup tambahan). Untuk MVP, kasih URL langsung ke user — mereka klik → browser handle auth Google sendiri.

### 4.4. Update komponen yang ada

#### `DraftingPKSView.tsx`

**Hapus:**
- `<div contentEditable dangerouslySetInnerHTML>` block
- `PreviewModal` component
- Char-count tracking logic (`DraftingPKSView.tsx:324-371`)
- Tombol "Rapihkan Format (WYSIWYG)" yang buka `DocumentEditor`
- Logic terkait `content_html` di state

**Tambah:**
- Tombol "Generate ke Google Docs" → call `/api/drafting/generate-google-doc`
- Setelah generate: tampilkan success state dengan:
  - Tombol "Buka di Google Docs" (link `edit_url`)
  - Iframe embed Google Docs (preview)
  - Tombol "Submit untuk Review CM" → call `/api/drafting/save-version` + advance tahap

**Note:** Form 81 placeholder TETAP ADA. Tidak diubah. Hanya output-nya yang beda (sebelumnya HTML, sekarang Google Doc).

#### `CMReviewDraft.tsx`

**Hapus:**
- HTML preview block
- Diff logic antar version HTML
- Char-count comparison logic

**Tambah:**
- Iframe embed Google Doc (read-only viewer mode)
- Tombol "Buka untuk Suggest Changes" → call `/api/drafting/share` dengan role `commenter` untuk CM → redirect ke Google Doc
- Tombol "Approve" → call `/api/drafting/review` dengan status `approved` → advance tahap
- Tombol "Return with catatan" → modal input catatan → call `/api/drafting/review` dengan status `returned` + catatan
- Tombol "Takeover" → buka `CMTakeoverModal` (revised)
- Display "Pending Suggestions: X" → call `/api/drafting/sync-status` on load. Kalau > 0, tombol "Approve" disable dengan tooltip "Resolve X pending suggestions dulu"

#### `CMTakeoverModal.tsx`

**Hapus:**
- Textarea untuk HTML mentah
- Endpoint `/api/pengajuan-dokumen/upload` reference (itu untuk dokumen wajib, bukan untuk PKS)

**Tambah:**
- 2 mode:
  1. **Editor Mode**: Call `/api/drafting/share` dengan role `writer` untuk CM → buka Google Doc → CM edit langsung. Setelah CM selesai, klik "Sudah Selesai Edit" → advance tahap.
  2. **File Upload Mode**: CM upload .docx final → upload ke Supabase Storage → set `file_docx_path` di `wpa_pks` → advance tahap

#### `PipelineDetailView.tsx`

**Update bagian Print Final (tahap `tanda_tangan`):**
- Hapus `window.print()` logic
- Tambah tombol "Download .docx" → redirect ke `/api/drafting/download-docx?pipeline_id=xxx`
- Tambah tombol "Download PDF" → redirect ke `https://docs.google.com/document/d/{doc_id}/export?format=pdf`
- Tambah tombol "Upload Signed PDF" → upload hasil scan TTD basah → save ke `wpa_pks.signed_pdf_path`

### 4.5. Hapus file tidak terpakai

```bash
rm src/components/wpa/DocumentEditor.tsx
rm src/app/api/drafting/generate/route.ts  # mammoth-based, diganti
rm src/app/api/dokumen-operasional/preview/route.ts  # kalau TipTap dihapus
```

### 4.6. Update `package.json`

Hapus dependencies:
```json
{
  "devDependencies": {
    "mammoth": ...,  // hapus
    "@tiptap/core": ...,  // hapus
    "@tiptap/starter-kit": ...,  // hapus
    "@tiptap/extension-underline": ...,  // hapus
    "@tiptap/extension-text-align": ...,  // hapus
    "@tiptap/extension-highlight": ...,  // hapus
    "@tiptap/extension-table": ...,  // hapus (tidak pernah dipakai)
    "docx": ...  // hapus (tidak pernah dipakai)
  }
}
```

Lalu `npm install` untuk update lock file.

### 4.7. Fix 2 endpoint missing (sekalian)

Sambil migrasi, buat juga:
- `/api/template/upload` (POST) — untuk Super Admin upload template (sebelumnya broken)
- `/api/pengajuan-dokumen/upload` (POST) — untuk PIC RS upload dokumen wajib (sebelumnya broken)

**Detail:**
- `/api/template/upload`: receive .docx + metadata → upload ke Storage → insert ke `wpa_pks_template` → set `google_doc_template_id` (kalau user juga upload ke Google Docs) atau `file_docx_path` (untuk backward compat)
- `/api/pengajuan-dokumen/upload`: receive file + pipeline_id + jenis → upload ke Storage → insert ke `wpa_dokumen_pengajuan`

Lihat `docs/09_KNOWN_ISSUES.md` section Critical untuk spec detail.

### 4.8. Komponen baru (reusable)

Buat `src/components/wpa/GoogleDocEmbed.tsx`:

```tsx
'use client'
interface Props {
  docId: string
  mode?: 'view' | 'edit'
  height?: string
}

export function GoogleDocEmbed({ docId, mode = 'view', height = '600px' }: Props) {
  const url = mode === 'edit'
    ? `https://docs.google.com/document/d/${docId}/edit`
    : `https://docs.google.com/document/d/${docId}/preview`
  return (
    <iframe
      src={url}
      width="100%"
      height={height}
      style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
      allowFullScreen
    />
  )
}
```

Buat `src/components/wpa/GoogleDocLink.tsx`:

```tsx
'use client'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  docId: string
  label?: string
  variant?: 'default' | 'outline' | 'secondary'
}

export function GoogleDocLink({ docId, label = 'Buka di Google Docs', variant = 'default' }: Props) {
  return (
    <Button asChild variant={variant}>
      <a href={`https://docs.google.com/document/d/${docId}/edit`} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-2 h-4 w-4" />
        {label}
      </a>
    </Button>
  )
}
```

---

## Tahap 5 — Deploy & Test (Anda + Saya, 1 hari)

### 5.1. Deploy
1. Pull latest code dari git
2. Set 5 environment variables di Vercel (Tahap 4.1)
3. Run migration SQL di Supabase dashboard (Tahap 4.2)
4. Deploy ke Vercel

### 5.2. Test End-to-End dengan 1 Faskes Sampel

#### Test 1: PKS Baru
- [ ] Login sebagai CM → onboarding faskes baru (create PIC RS user)
- [ ] Login sebagai PIC RS → buka `/pic_rs/ajukan-baru/pks-baru`
- [ ] Upload 7 dokumen wajib → submit
- [ ] Login sebagai CM → advance ke tahap `ditinjau_kajian_tarif` → run tarif scan → advance ke `kredensialing` → advance ke `drafting_pks`
- [ ] Login sebagai PIC RS → buka drafting page
- [ ] Isi form 81 placeholder → klik "Generate ke Google Docs"
- [ ] Verifikasi: Google Doc terbentuk di akun document owner (cek Google Drive)
- [ ] Verifikasi: Google Doc ter-share ke PIC RS + CM (cek Google Drive "Shared with me")
- [ ] Klik "Buka di Google Docs" → buka → edit sedikit → save (auto-save Google)
- [ ] Klik "Submit untuk Review CM"
- [ ] Login sebagai CM → buka review page
- [ ] Klik "Buka untuk Suggest Changes" → buka Google Doc → ubah mode "Suggesting" → koreksi 1 kalimat → add 1 comment → close tab
- [ ] Kembali ke Next.js → refresh → "Pending Suggestions: 1" muncul
- [ ] Klik "Approve" → harusnya gagal (ada pending suggestions) → tooltip jelas
- [ ] Klik "Return with catatan" → isi catatan → submit
- [ ] Login sebagai PIC RS → lihat catatan CM → accept suggestion di Google Doc → balik ke Next.js → refresh → pending = 0
- [ ] Submit lagi untuk review
- [ ] CM → Approve → pipeline advance ke `approval_kabid`
- [ ] Login sebagai Kabid → Approve → advance ke `review_legal_rs`
- [ ] Login sebagai Legal RS → Review → Approve → advance ke `tanda_tangan`
- [ ] Login sebagai Kabid → klik "Download .docx" → .docx download → buka di Word → verifikasi format OK
- [ ] Print, TTD basah, scan → upload signed PDF
- [ ] Pipeline → `completed`

#### Test 2: Perpanjangan
- [ ] Dari PKS yang sudah completed di Test 1, tunggu sampai countdown < 3 bulan (atau manual set `tanggal_akhir` di DB)
- [ ] PIC RS → klik "Ajukan Perpanjangan"
- [ ] Verifikasi: form 81 placeholder terisi otomatis untuk field `auto_clone: true` (identitas, bank, PJ)
- [ ] Verifikasi: field `auto_clone: false` kosong (nomor PKS baru, tanggal baru)
- [ ] Verifikasi: field `NOMOR_PKS_SEBELUMNYA_*` terisi dari PKS lama
- [ ] Generate Google Doc → verifikasi dokumen terisi dengan data cloned
- [ ] Lanjut flow sama dengan Test 1

#### Test 3: Adendum Masal
- [ ] Super Admin → publish template adendum masal baru (mis. "Penambahan Layanan Telemedicine")
- [ ] Login sebagai PIC RS di 3 faskes berbeda → submit form adendum masal
- [ ] Login sebagai CM → buka group review → ceklis 3 faskes → klik "Setuju Bareng"
- [ ] Verifikasi: 3 pipeline auto-complete, `google_doc_url` terisi untuk masing-masing
- [ ] Verifikasi: PIC RS ketiga faskes dapet notif "Adendum Masal approved, PDF siap di-print"

### 5.3. Bug Fix
- [ ] Screenshot error + kirim ke developer
- [ ] Patch + redeploy

---

## Tahap 6 — Onboarding User (Anda, 1 hari)

### 6.1. Training PIC RS

Buat panduan singkat (1 halaman):
- Cara buka link Google Docs dari aplikasi Mitra PLKK
- Cara edit langsung di Google Docs (auto-save, tidak perlu klik save)
- Cara submit kembali ke aplikasi (tombol "Submit untuk Review CM" di Mitra PLKK, BUKAN di Google Docs)
- **Highlight:** jangan delete placeholder yang belum terisi (kalau CM belum approve revisi)
- **Highlight:** jangan ubah nama file Google Docs

### 6.2. Training CM

Buat panduan singkat:
- Cara nyalakan Suggestion Mode (ikon pensil kanan atas → "Suggesting")
- Cara add comment (highlight text → Ctrl+Alt+M atau klik "Add comment" icon)
- Cara resolve comment setelah di-action PIC RS
- Cara accept/reject suggestion (klik "Check" untuk accept, "X" untuk reject)
- **Highlight:** pipeline tidak bisa advance kalau masih ada pending suggestions. Resolve dulu semua.
- **Highlight:** kalau perlu edit langsung (bukan suggestion), pakai mode "Takeover" di aplikasi

### 6.3. Training Kabid

Panduan:
- Cara download .docx final (klik "Download .docx" di pipeline detail)
- Cara download PDF (klik "Download PDF")
- Cara upload signed PDF setelah TTD basah

### 6.4. Training Super Admin

- Cara upload template Google Docs baru (dapat template ID, masukkan ke `wpa_pks_template.google_doc_template_id` via SQL atau UI)
- Cara update `TEMPLATE_IDS` di Apps Script (re-deploy Apps Script)
- Cara rotate document owner kalau perlu (pindah semua dokumen ke akun baru via Google Drive → move)

---

## Timeline Total

| Tahap | Durasi | Pihak | Output |
|---|---|---|---|
| 0. Persiapan & validasi | 30 menit | Anda | Compliance OK, akun Google siap, 6 template .docx |
| 1. Setup Google Cloud | 20 menit | Anda | Client ID + Secret, Project ID |
| 2. Deploy Apps Script | 1 jam | Anda | Web App URL |
| 3. Setup template Google Docs | 2 jam | Anda | 6 template dengan placeholder |
| 4. Migrasi code | 2-3 hari | Saya / AI pengganti | Code siap deploy |
| 5. Deploy & test | 1 hari | Anda + saya | Aplikasi siap pakai |
| 6. Onboarding user | 1 hari | Anda | User trained |
| **Total** | **5-6 hari kerja** | | |

---

## Rollback Plan

Kalau migrasi gagal dan perlu rollback ke status quo:

### Quick rollback (dalam 24 jam pertama):
1. Set env var `MIGRATION_GOOGLE_DOCS_ENABLED=false` → code check flag ini, kalau false → fallback ke lama (mammoth)
2. Deploy ulang
3. User lanjut pakai flow lama (yang broken, tapi familiar)

### Full rollback (kalau data sudah terlanjur ter-split):
1. Restore `wpa_pks_draft_versions.content_html` dari `content_html_deprecated`
2. Drop kolom `google_doc_*` (yang ditambah di Tahap 4.2)
3. Reinstall `mammoth`, `@tiptap/*`, `docx` di package.json
4. Restore file `DocumentEditor.tsx`, `/api/drafting/generate/route.ts`, `/api/dokumen-operasional/preview/route.ts` dari git history
5. Revert perubahan di `DraftingPKSView.tsx`, `CMReviewDraft.tsx`, `CMTakeoverModal.tsx`, `PipelineDetailView.tsx`
6. Reinstall Apps Script (no-op, biarkan saja)
7. User lanjut pakai flow lama

**Note:** Rollback adalah last resort. Status quo sudah broken (lihat `docs/09_KNOWN_ISSUES.md`). Lebih baik investasi 1-2 hari untuk fix bug migration daripada rollback ke codebase yang sudah tidak maintained.

---

## FAQ

**Q: Bisakah tetap pakai .docx template yang sudah ada (tanpa upload ke Google Docs)?**
A: Tidak. Apps Script `DocumentApp.openById()` hanya bisa buka Google Docs (bukan .docx). Anda harus convert .docx → Google Docs dengan upload ke Drive + "Open with Google Docs" (auto-convert).

**Q: Bagaimana kalau PIC RS tidak punya akun Google?**
A: PIC RS wajib punya Google account (boleh @gmail.com atau Workspace). Kalau tidak, mereka tidak bisa edit Google Doc. Workaround: pakai file_upload mode di CM Takeover (CM upload .docx final, PIC RS tidak edit).

**Q: Bagaimana kalau Internet down?**
A: Google Docs butuh Internet. Tidak ada offline mode. Tapi Google Docs mobile app support edit offline (auto-sync saat online). PIC RS bisa install app di HP.

**Q: Bisakah batasi PIC RS hanya edit area tertentu (tidak bisa ubah header/footer)?**
A: Google Docs tidak punya "form field" seperti Word. Tapi Anda bisa pakai protected ranges (via Google Docs API atau manual di UI). Implementasi: setelah generate,Apps Script set protected range untuk semua bagian kecuali area yang PIC RS boleh edit. Advanced — implementasi Tahap 7 (post-MVP).

**Q: Bagaimana kalau perlu revisi PKS setelah TTD?**
A: PKS yang sudah TTD = final. Kalau perlu revisi, buat adendum baru (adendum_harga / perubahan_data / dll). Jangan edit Google Doc yang sudah TTD.

**Q: Bagaimana dengan audit trail?**
A: Google Docs punya version history built-in (unlimited). Plus audit log Mitra PLKK tetap jalan (semua action via Next.js API tetap di-log ke `wpa_audit_logs`). Combine keduanya untuk audit lengkap.

**Q: Bisakah export ke PDF server-side (tanpa user klik)?**
A: Bisa, tapi butuh OAuth2 service account + library `googleapis` di Next.js. Advanced. Untuk MVP, kasih user URL `https://docs.google.com/document/d/{doc_id}/export?format=pdf` — browser handle auth Google sendiri. Implementasi server-side di Tahap 7 (post-MVP).
