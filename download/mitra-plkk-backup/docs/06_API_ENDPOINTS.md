# 06 — API Endpoints (Full Inventory)

> Total: 50+ endpoints di `src/app/api/`
> Auth: semua endpoint (kecuali `/api/auth/*` dan `/api/health`) butuh cookie `wpa_session` valid

## Auth

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/auth/login` | POST | Login email+password → set cookie `wpa_session` |
| `/api/auth/logout` | POST | Hapus cookie, logout |
| `/api/health` | GET | Health check (no auth) |
| `/api/setup` | POST | Initial setup (hanya jika no users exist) |

## Profile (self-service)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/profile/update` | POST | Update nama, phone |
| `/api/profile/email` | POST | Update email (perlu verifikasi) |
| `/api/profile/password` | POST | Ganti password |
| `/api/profile/photo` | POST | Upload foto profil |

## Kantor Cabang

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/kantor` | GET | List kantor (filter by role) |
| `/api/kantor` | POST | Create kantor (super_admin only) |
| `/api/kantor/[id]` | GET | Detail kantor |
| `/api/kantor/[id]` | PATCH | Update kantor |
| `/api/kantor/[id]` | DELETE | Deactivate kantor (soft delete) |
| `/api/kantor/[id]/users` | GET | List users di kantor ini |
| `/api/kantor/batch-import` | POST | Batch import kantor dari Excel |
| `/api/kantor/template` | GET | Download template Excel untuk batch import |

## Users

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/users/create` | POST | Create user (CM bisa create PIC RS di cabangnya) |
| `/api/users/update` | PATCH | Update user |
| `/api/users/batch-import` | POST | Batch import users dari Excel |
| `/api/users/template` | GET | Download template Excel untuk batch import |

## Faskes

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/faskes/template` | GET | Template Excel untuk batch import faskes (81 kolom) |
| `/api/faskes/batch-import` | POST | Batch import faskes |
| `/api/faskes/multi-attach` | POST | Attach faskes ke multiple kantor cabang |

## Pipeline (state machine)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/pipeline/list` | GET | List pipeline dengan filter role + tahap + jenis |
| `/api/pipeline/detail/[id]` | GET | Detail pipeline (fault-tolerant select) |
| `/api/pipeline/transition` | POST | Advance to next tahap |
| `/api/pipeline/takeover` | POST | PP ambil alih tugas dari CM |
| `/api/pipeline/takeover-toggle` | POST | Toggle takeover status |

## Pengajuan Baru (PIC RS submit)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/pengajuan-baru/create` | POST | PIC RS create pengajuan baru (semua jenis) |
| `/api/pengajuan-draft/create` | POST | Save draft pengajuan (sebelum submit) |
| `/api/pengajuan-draft/submit` | POST | Submit pengajuan (validate dokumen wajib) |
| `/api/pengajuan-dokumen/list` | GET | List dokumen per pipeline |
| `/api/pengajuan-dokumen/upload` | POST | **MISSING — harus dibuat!** Upload dokumen wajib |

## PKS Baru (CM onboarding faskes)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/cm/pks-baru/create` | POST | CM onboarding faskes baru (create PIC RS user + set `can_submit_pks_baru`) |

## Perpanjangan

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/perpanjangan/create` | POST | PIC RS create perpanjangan + auto-clone data dari PKS lama |

## Adendum

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/adendum/create` | POST | PIC RS create adendum (harga/layanan/perubahan_data) |

## Adendum Masal

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/adendum-masal/list-templates` | GET | List template adendum masal yang active |
| `/api/adendum-masal/create` | POST | PIC RS submit adendum masal (1 form per template) |
| `/api/adendum-masal/list-pending` | GET | List pending adendum masal untuk CM group review |
| `/api/adendum-masal/group-action` | POST | CM group approve/reject (1 aksi untuk multiple) |
| `/api/adendum-masal/detail` | GET | Detail adendum masal |

## Drafting PKS/Adendum

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/drafting/start` | POST | Start drafting session (validate template exists) |
| `/api/drafting/generate` | POST | **[BEFORE]** Generate HTML via mammoth. **[AFTER MIGRATION]** Ganti dengan `/api/drafting/generate-google-doc` |
| `/api/drafting/save-version` | POST | Save draft version (v1-v4) |
| `/api/drafting/versions` | GET | List versions per pks_id |
| `/api/drafting/version/[id]` | GET | Detail version |
| `/api/drafting/review` | POST | CM approve/return draft with catatan |
| `/api/drafting/takeover` | POST | CM takeover draft (system_edit / file_upload) |
| `/api/drafting/save` | POST | Auto-save (debounced) |

## Template Management

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/template/list` | GET | List template (filter by jenis) |
| `/api/template/detail/[id]` | GET | Detail template + placeholders |
| `/api/template/toggle` | POST | Toggle active/inactive |
| `/api/template/upload` | POST | **MISSING — harus dibuat!** Upload template .docx |
| `/api/template-operasional/list` | GET | List template dokumen operasional |

## Tarif

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/tarif/template` | GET | Template Excel untuk batch import tarif |
| `/api/tarif/template-standar` | GET | List 75+ item tarif standar |
| `/api/tarif/batch-import` | POST | Batch import tarif acuan |
| `/api/tarif/acuan/create` | POST | Create tarif acuan (provinsi ceiling / rata-rata daerah) |
| `/api/tarif/acuan/list` | GET | List tarif acuan per cabang |
| `/api/tarif/acuan/calc` | POST | Calculate rata-rata daerah dari RS survey |
| `/api/tarif/scan` | POST | Pattern scan tarif faskes (Excel) vs Bank Tarif |
| `/api/tarif/ai-review` | POST | AI second opinion untuk kajian tarif |
| `/api/tarif/comparison` | GET | Comparison tarif antar faskes / antar acuan |
| `/api/tarif/konversi` | POST | Konversi tarif format (excel → DB) |
| `/api/tarif/faskes/list` | GET | List tarif faskes per pipeline |

## AI Keys

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/ai-keys` | GET | List AI keys per cabang |
| `/api/ai-keys` | POST | Add new key |
| `/api/ai-keys` | PATCH | Update key (activate/deactivate/default/reset) |
| `/api/ai-keys` | DELETE | Delete key |

## Dokumen Operasional (surat menyurat post-PKS)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/dokumen-operasional/list` | GET | List dokumen operasional per faskes |
| `/api/dokumen-operasional/create` | POST | Create dokumen operasional |
| `/api/dokumen-operasional/preview/[id]` | GET | Preview dokumen |
| `/api/dokumen-operasional/save/[id]` | POST | Save dokumen (TipTap HTML) |
| `/api/dokumen-operasional/review` | POST | CM review dokumen |
| `/api/dokumen-operasional/send` | POST | Send dokumen ke faskes |

## Dropping Pusat

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/dropping-pusat/create` | POST | Create dropping pusat |
| `/api/dropping-pusat/faskes-list` | GET | List faskes yang eligible untuk dropping |

## Mutasi

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/mutasi/create` | POST | Create mutasi faskes antar cabang |
| `/api/mutasi/list` | GET | List mutasi |
| `/api/mutasi/cancel` | POST | Cancel mutasi (jika belum completed) |

## Print

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/print/slip-kredensial` | POST | Print slip kredensial (1 user) |
| `/api/print/slip-a4` | POST | Print slip kredensial format A4 (batch) |
| `/api/print/kartu-mutasi` | POST | Print kartu mutasi faskes |

## Cron (Vercel Cron)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/cron/mutasi` | GET | Cron job: process pending mutasi (every 1 hour) |

## Bot

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/bot/chat` | POST | Chatbot FAQ (login page) |

---

## Endpoint Pattern & Auth

### Request pattern

```typescript
// POST/PUT/PATCH
const res = await fetch('/api/...', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // kirim cookie wpa_session
  body: JSON.stringify(payload)
})

// GET
const res = await fetch('/api/...?filter=value', { credentials: 'include' })
```

### Response pattern

```typescript
// Success
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": "Human-readable error message" }
```

### Auth check (server-side)

```typescript
import { getSession } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // Check role
  if (session.role !== 'case_manager' && session.role !== 'super_admin') {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // ... business logic
}
```

### `getSession()` performance

`getSession()` dipakai `React.cache()` untuk avoid re-fetch dalam satu request. Jangan fetch manual dari DB di setiap server component — pakai `getSession()`.

```typescript
// src/lib/auth.ts
import { cache } from 'react'

export const getSession = cache(async () => {
  // ... fetch from DB based on cookie
})
```

---

## Yang Perlu Dibuat (Missing Endpoints)

Berdasarkan audit, 2 endpoint critical belum ada:

### 1. `/api/template/upload` (POST)
- Dipanggil oleh `TemplateManager.tsx` (super admin)
- Upload .docx template ke Supabase Storage bucket `wpa-templates`
- Save record ke `wpa_pks_template` (file_docx_path)
- Extract placeholders via `mammoth` (atau manual parsing) → save ke `wpa_pks_template_placeholder`
- Setelah migrasi Google Docs: diganti dengan simpan `google_doc_template_id` saja

### 2. `/api/pengajuan-dokumen/upload` (POST)
- Dipanggil oleh `FileUploader.tsx` (PIC RS upload dokumen wajib)
- Upload file ke Supabase Storage bucket `wpa-dokumen`
- Save record ke `wpa_dokumen_pengajuan` (pipeline_id, jenis, file_path, uploaded_by)
- Tidak ada hubungan dengan migrasi Google Docs — endpoint ini tetap perlu

---

## Endpoint Baru (Setelah Migrasi Google Docs)

Lihat `nextjs_api_stubs/generate_google_doc.ts` untuk stub. Endpoint baru:

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/drafting/generate-google-doc` | POST | Call Apps Script → clone template + replace placeholder → return docId+URL |
| `/api/drafting/share` | POST | Share Google Doc ke PIC RS + CM (auto-share saat generate) |
| `/api/drafting/sync-status` | GET | Cek apakah ada pending suggestions di Google Doc (untuk pipeline advance validation) |
| `/api/drafting/download-docx` | GET | Proxy download .docx dari Google Docs (karena direct URL butuh auth) |
| `/api/drafting/download-pdf` | GET | Proxy download .pdf dari Google Docs |
