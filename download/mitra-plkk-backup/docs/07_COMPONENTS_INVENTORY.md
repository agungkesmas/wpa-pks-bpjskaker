# 07 — Components Inventory

> Daftar komponen React di `src/components/wpa/` (yang custom, bukan shadcn/ui)

## Layout & Shell

### `RoleShell.tsx`
Shell utama per role. Fitur:
- Collapsible sidebar (default collapsed di mobile, expanded di desktop)
- Persist state collapse ke localStorage
- Logo + "Mitra PLKK BPJS Ketenagakerjaan" di header
- Sidebar header: "Navigation"
- User info (nama, role, foto) di TOP sidebar
- Sub-menu dengan indentasi
- Mobile responsive (sheet drawer)

### `RoleLayout.tsx`
Wrapper parallel queries untuk data umum (kantor, faskes, notifications) via `Promise.all`. Hindari waterfall request.

## Pipeline Views

### `PipelineDetailView.tsx`
Detail pipeline dengan conditional rendering per tahap:
- Tahap `diajukan`: display dokumen wajib + cancel button (PIC RS only)
- Tahap `ditinjau_kajian_tarif`: display `TarifScanResult` (CM review)
- Tahap `kredensialing`: display kredensialing form / visitasi notes
- Tahap `drafting_pks` / `drafting_adendum`:
  - Untuk PIC RS: `DraftingPKSView`
  - Untuk CM: `CMReviewDraft` + `CMTakeoverModal`
- Tahap `approval_kabid`: display approve/return buttons
- Tahap `review_legal_rs`: display review form untuk Legal RS
- Tahap `tanda_tangan`: display "Print PKS Final" button
- Tahap `completed`: display signed PDF

### `TugasSayaView.tsx`
List "Tugas Saya" dengan tabs:
- Individual
- Adendum Masal
- Dropping Pusat
Fitur: filter (by jenis, tahap, faskes), sort (by SLA, by tanggal), action button context-aware per item.

### `TugasCabangView.tsx`
List "Tugas Cabang" (untuk CM multi-CM, atau Kabid oversight) dengan tabs:
- Approval (untuk Kabid)
- Semua Tugas
- Dropping Pusat

## Drafting

### `DraftingPKSView.tsx` [PIC RS side]
- Form 81 placeholder di-generate dari `pks-placeholders.ts`
- Grouped by kategori (Identitas Faskes, Bank, dll)
- Tombol "Generate & Preview" → call `/api/drafting/generate`
- **[BEFORE]** Inline edit via `<div contentEditable dangerouslySetInnerHTML>`
- **[BEFORE]** Tombol "Rapihkan Format (WYSIWYG)" → buka `DocumentEditor` (BROKEN — wrong API)
- Tombol "Save Version" → call `/api/drafting/save-version`
- Tombol "Submit untuk Review CM" → advance tahap
- Char count tracking per paragraph (±10% tolerance) — **BROKEN** karena browser normalize HTML inkonsisten

### `CMReviewDraft.tsx` [CM side]
- Display draft version yang di-submit PIC RS
- **[BEFORE]** HTML preview (read-only) dengan diff vs version sebelumnya
- Tombol "Approve" → advance ke approval_kabid
- Tombol "Return with catatan" → set catatan_cm, balik ke PIC RS
- Tombol "Takeover" → buka `CMTakeoverModal`
- History version (v1, v2, v3, v4) di sidebar

### `CMTakeoverModal.tsx` [CM takeover]
- Pilih mode:
  1. System edit (label: TipTap, reality: `<Textarea className="font-mono text-xs">` untuk HTML mentah) — **MISLEADING UI**
  2. File upload (.docx) → call `/api/pengajuan-dokumen/upload` (MISSING endpoint)
- Setelah takeover, advance ke approval_kabid

### `DocumentEditor.tsx` [BROKEN — DELETE AFTER MIGRATION]
- TipTap editor dengan extension: StarterKit, Underline, TextAlign, Highlight
- **Missing:** Table, Image, TextStyle, Link, Subscript, Superscript, Strike, CodeBlock
- Wire to wrong API (`/api/dokumen-operasional/preview` instead of `/api/drafting/*`)
- Tabel di dokumen akan HILANG saat user buka editor
- **Rekomendasi:** Delete seluruh file setelah migrasi Google Docs. Tidak perlu TipTap lagi.

## Tarif

### `TarifScanResult.tsx`
- Summary cards: total item, WAJAR count, REVIEW count, TIDAK WAJAR count
- Detail table: item, tarif faskes, tarif acuan, % diff, status
- Tombol "AI Second Opinion" (optional) → call `/api/tarif/ai-review`
- Tombol "Advance to Kredensialing" (CM only)

### `TarifAcuanManager.tsx`
- Manage tarif acuan per cabang
- 2 mode: Provinsi ceiling, Rata-rata daerah
- Batch import via Excel
- Calc rata-rata daerah: pilih 3+ RS → calculate otomatis

### `UploadTarifFaskes.tsx`
- PIC RS upload Excel tarif
- Call `/api/tarif/scan` → return `TarifScanResult`

## Adendum Masal

### `AdendumMasalGroupReview.tsx`
- Untuk CM: list pending adendum masal
- Batch select (ceklis multi)
- Tombol "Setuju Bareng" / "Tolak Bareng" untuk yang diceklis
- Display detail per item (PIC RS, faskes, values)

## Faskes Management

### `CMFaskesManager.tsx`
- CM manage faskes di cabangnya
- List dengan filter (status, jenis, kota)
- Expand row untuk detail
- Batch select (ceklis) untuk bulk action:
  - Print slip kredensial (batch)
  - Reset password PIC RS (batch)
  - Activate/deactivate (batch)
- CRUD single faskes

### `FaskesBatchImport.tsx`
- Modal untuk batch import faskes dari Excel
- Template: 81 kolom = 81 placeholder
- Preview sebelum save
- Validation: nama wajib, NPWP unik, dll

## User Management

### `UserManagement.tsx`
- Super Admin manage semua user
- Filter by role, kantor, status
- CRUD user
- Reset password
- Print slip kredensial (batch)

### `KantorCabangManager.tsx`
- List kantor cabang
- CRUD kantor

### `KantorDetailManager.tsx`
- Detail kantor + tab users
- Manage user di kantor ini
- **TODO:** batch deactivate (belum diimplemen)

## Template Management

### `TemplateManager.tsx`
- Super Admin manage template PKS
- Upload template .docx — **BROKEN** (endpoint `/api/template/upload` missing)
- Toggle active/inactive
- View placeholders
- Set as default per jenis

## Dokumen

### `FileUploader.tsx`
- PIC RS upload dokumen wajib
- Drag-and-drop
- Progress bar
- **BROKEN** (endpoint `/api/pengajuan-dokumen/upload` missing)

### `DokumenOperasionalView.tsx`
- List dokumen operasional per faskes
- CM create dokumen via TipTap (atau upload .docx)
- Send ke faskes
- History

## AI Settings

### `AISettingsManager.tsx`
- CM/Kabid manage AI API keys
- Add key (provider, api_key, base_url, model)
- Activate/deactivate
- Set default
- Reset quota (manual, kalau auto-reset 1 jam belum cukup)
- Delete key

## Bot

### `BotReceptionist.tsx` (src/components/bot/)
- Chatbot FAQ di login page
- Lazy-loaded (dynamic import) untuk performance
- Pakai AI provider (Gemini default) untuk jawaban natural
- Fallback rule-based kalau AI error

## Profile

### `ProfileManager.tsx`
- Self-service: edit nama, phone, foto, password
- Upload foto (auto-resize client-side)
- Ganti password (perlu old password)

## Dropping Pusat

### `DroppingPusatView.tsx`
- List dropping pusat
- CM create dropping (pilih faskes + kantor tujuan)
- Kabid approve
- Legal RS review

## Batch Import (reusable)

### `BatchImportDialog.tsx`
- Modal reusable untuk batch import (kantor, user, faskes, tarif)
- Props: `endpoint`, `templateEndpoint`, `onSuccess`
- Drag-and-drop Excel
- Preview rows
- Validation errors display

## Misc

### `Placeholder.tsx`
- Loading skeleton component (jangan dibilang "placeholder PKS")

### `AjukanPerpanjanganButton.tsx`
- Button di PIC RS dashboard
- Cek apakah faskes punya PKS aktif yang akan berakhir (< 3 bulan)
- Modal konfirmasi → call `/api/perpanjangan/create`

---

## shadcn/ui Components (di `src/components/ui/`)

Standard shadcn/ui components, tidak custom:
- `alert`, `avatar`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `scroll-area`, `select`, `separator`, `sheet`, `sonner` (toast), `switch`, `table`, `tabs`, `textarea`, `tooltip`

---

## Yang Harus Diubah / Dihapus Setelah Migrasi Google Docs

### HAPUS:
- `DocumentEditor.tsx` — TipTap tidak dipakai lagi
- `mammoth` dependency di `package.json`
- `@tiptap/*` dependencies (semua)
- `docx` dependency (jangan dipakai, tidak terpakai)
- `/api/drafting/generate/route.ts` (yang mammoth-based)
- `/api/dokumen-operasional/preview/route.ts` (kalau TipTap dihapus)

### UBAH:
- `DraftingPKSView.tsx` — hapus `contentEditable` + PreviewModal. Tambah tombol "Generate ke Google Docs" + iframe embed.
- `CMReviewDraft.tsx` — hapus HTML diff. Ganti dengan embed Google Docs + tombol "Buka untuk Suggest Changes".
- `CMTakeoverModal.tsx` — hapus textarea HTML. Ganti "Buka di Google Docs" + pilih mode (editor / file_upload).
- `PipelineDetailView.tsx` — bagian Print Final, ganti `window.print()` dengan "Download .docx" / "Download .pdf" (link ke Google export).
- `DokumenOperasionalView.tsx` — ganti TipTap dengan embed Google Docs (atau tetap text-only untuk dokumen operasional kecil)

### TAMBAH:
- Komponen baru: `GoogleDocEmbed.tsx` — iframe Google Docs viewer (1 baris, tapi reusable)
- Komponen baru: `GoogleDocLink.tsx` — tombol "Buka di Google Docs" dengan icon
