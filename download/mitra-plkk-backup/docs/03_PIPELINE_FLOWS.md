# 03 — Pipeline Flows

## Overview State Machine

Setiap PKS/adendum mengikuti pipeline state machine dengan tahapan yang berbeda per jenis pengajuan. Total **7 jenis pengajuan** × **6 tahap** (max).

```
                    ┌──────────────────────────────────────────────────┐
                    │                                                  │
                    ▼                                                  │
            ┌──────────────┐                                          │
            │  diajukan    │ ← PIC RS submit (upload surat + file)    │
            └──────┬───────┘                                          │
                   │                                                  │
                   ▼                                                  │
     ┌─────────────────────────────────┐                              │
     │ ditinjau_kajian_tarif           │ ← CM review + tarif scan     │
     │ (alias: ditinjau, tinjauan_     │ + AI second opinion          │
     │  tarif, negosiasi_tarif)        │                              │
     └────────────────┬────────────────┘                              │
                      │                                               │
                      ▼                                               │
            ┌──────────────────┐                                     │
            │ kredensialing    │ ← CM asesmen mandiri / visitasi      │
            └────────┬─────────┘                                     │
                     │                                               │
                     ▼                                               │
            ┌──────────────────────┐                                 │
            │ drafting_pks /       │ ← PIC RS isi placeholder + edit │
            │ drafting_adendum     │   CM review + 3x koreksi +      │
            │                      │   takeover jika perlu           │
            └────────┬─────────────┘                                 │
                     │                                               │
                     ▼                                               │
            ┌──────────────────┐                                     │
            │ approval_kabid   │ ← Kabid approve (4-eyes)            │
            └────────┬─────────┘                                     │
                     │                                               │
                     ▼                                               │
            ┌──────────────────┐                                     │
            │ review_legal_rs  │ ← Legal RS review                   │
            └────────┬─────────┘                                     │
                     │                                               │
                     ▼                                               │
            ┌──────────────────┐                                     │
            │ tanda_tangan     │ ← Kabid TTD basah                   │
            └────────┬─────────┘                                     │
                     │                                               │
                     ▼                                               │
            ┌──────────────────┐                                     │
            │   completed      │                                     │
            └──────────────────┘                                     │
                                                                     │
Pipeline status terpisah dari tahap:                                 │
- status = 'in_progress'  (default)                                  │
- status = 'cancelled'    (PIC RS cancel di tahap diajukan/ditinjau) │
- status = 'completed'    (final)                                    │
                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Tahap per Jenis Pengajuan

### 1. `pks_baru` — PKS Baru (6 tahap)

| # | Tahap | Handler | SLA | Aksi |
|---|---|---|---|---|
| 1 | `diajukan` | PIC RS | 1 hari | Upload surat pengantar + 7 file wajib (akta, izin, NPWP, SK PJ, dll) |
| 2 | `ditinjau_kajian_tarif` | CM | 3 hari | Review surat + scan tarif vs acuan + AI second opinion |
| 3 | `kredensialing` | CM | 5 hari | Asesmen mandiri (default) atau visitasi (jika red flag dari kajian tarif) |
| 4 | `drafting_pks` | PIC RS + CM | 5 hari | PIC RS isi 81 placeholder + edit dokumen; CM review 3x koreksi + takeover |
| 5 | `approval_kabid` | Kabid | 2 hari | Approve atau return dengan catatan |
| 6 | `review_legal_rs` | Legal RS | 5 hari | Review dari sisi hukum RS |
| 7 | `tanda_tangan` | Kabid | 3 hari | TTD basah kedua belah pihak |

**Total SLA target:** 24 hari kerja

### 2. `perpanjangan` — Perpanjangan PKS (6 tahap, sama dengan pks_baru)

| # | Tahap | Handler | SLA | Aksi khusus |
|---|---|---|---|---|
| 1 | `diajukan` | PIC RS | 1 hari | Upload surat + tarif. **Auto-clone data dari PKS lama** (80% field terisi otomatis) |
| 2-7 | Sama dengan pks_baru | | | |

**Khusus:** `cloneDataForPerpanjangan()` dari `pks-placeholders.ts`:
- Field `auto_clone: true` (identitas, bank, PJ) → copy dari PKS lama
- Field `auto_clone: false` (nomor PKS baru, tanggal, BA negosiasi) → reset
- Field `NOMOR_PKS_SEBELUMNYA_*` → diisi dari PKS lama

### 3. `adendum_harga` — Adendum Tarif (6 tahap)

Sama dengan pks_baru, tapi drafting pakai `drafting_adendum` (bukan `drafting_pks`). PIC RS upload 3 file: surat pengantar adendum, lampiran detail perubahan tarif, tarif baru.

### 4. `adendum_layanan_baru` — Adendum Layanan Baru (6 tahap)

Sama dengan adendum_harga, tapi untuk penambahan layanan baru (mis. ICU baru, poli baru). 3 file wajib: surat, lampiran detail layanan baru (nama, kode, tarif), tarif layanan baru.

### 5. `adendum_dropping` — Dropping Pusat (4 tahap, skip awal)

| # | Tahap | Handler | SLA | Aksi |
|---|---|---|---|---|
| 1 | `drafting_adendum` | CM | 14 hari | Auto-assign, drafting per target faskes |
| 2 | `approval_kabid` | Kabid | 2 hari | Approve |
| 3 | `review_legal_rs` | Legal RS | 5 hari | Review |
| 4 | `tanda_tangan` | Kabid | 3 hari | TTD |

**Konteks:** Kantor Pusat BPJS ingin hapus faskes tertentu dari daftar PLKK cabang tertentu (mis. faskes tutup, atau pindah ke cabang lain). Tidak ada file dari PIC RS (CM yang handle).

### 6. `adendum_masal` — Adendum Masal (3 tahap)

| # | Tahap | Handler | SLA | Aksi |
|---|---|---|---|---|
| 1 | `diajukan` | PIC RS | 1 hari | Submit form placeholder (1 form untuk 1 template adendum) |
| 2 | `ditinjau` | CM | 3 hari | Group review: ceklis multi → setuju/tolak bareng |
| 3 | `completed` | - | 0 hari | Auto-complete, PDF siap print TTD basah |

**Konteks:** BPJS Pusat terbitkan adendum template (mis. penambahan layanan Covid). PIC RS semua faskes submit form → CM group review (1 klik untuk approve 50 faskes sekaligus).

### 7. `perubahan_data` — Adendum Perubahan Data (5 tahap, skip kredensialing)

| # | Tahap | Handler | SLA | Aksi |
|---|---|---|---|---|
| 1 | `diajukan` | PIC RS | 1 hari | Upload surat + lampiran perubahan (field lama → field baru + dokumen pendukung) |
| 2 | `ditinjau` | CM | 2 hari | Review perubahan |
| 3 | `drafting_adendum` | PIC RS + CM | 3 hari | Draft adendum perubahan |
| 4 | `approval_kabid` | Kabid | 2 hari | Approve |
| 5 | `review_legal_rs` | Legal RS | 5 hari | Review |
| 6 | `tanda_tangan` | Kabid | 3 hari | TTD |

**Konteks:** Faskes ganti nama, ganti PJ, ganti rekening bank, dll. Bukan perubahan tarif (itu adendum_harga), bukan penambahan layanan (itu adendum_layanan_baru).

---

## Pipeline State & Status

Setiap pipeline record di `wpa_pipeline` punya:

```sql
current_tahap   text  -- tahap aktif sekarang
status          text  -- 'in_progress' | 'cancelled' | 'completed'
```

### Cancel rules:
- PIC RS bisa cancel di tahap `diajukan` atau `ditinjau_kajian_tarif` saja
- Setelah lewat itu, cancel harus via Super Admin (manual SQL)
- Cancel tidak hapus record, hanya set `status='cancelled'` + `cancelled_at`

### Complete rules:
- Pipeline auto-set `status='completed'` ketika `current_tahap='completed'`
- Untuk `adendum_masal`, complete terjadi setelah CM group-action

---

## Drafting Sub-Flow (Detail khusus tahap drafting_pks / drafting_adendum)

```
PIC RS start drafting
        │
        ▼
   ┌─────────────────────────────┐
   | Generate Draft v1           |
   | (isi 81 placeholder + edit) |
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   | Submit untuk Review CM      |
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   | CM Review Draft             |
   | - Approve → advance ke      |
   |   approval_kabid            |
   | - Return with catatan       |
   |   (PIC RS perlu revisi)     |
   | - Takeover (CM edit sendiri)|
   └──────────────┬──────────────┘
                  │
            ┌─────┴─────┐
            │           │
            ▼           ▼
        Approve      Return
            │           │
            │           ▼
            │     PIC RS revisi
            │           │
            │           ▼
            │     Generate v2 (max 3x revisi)
            │           │
            │           ▼
            │     Submit lagi → CM review
            │           │
            ▼           │
       Advance          │
       to next          │
       tahap            │
                        │
                Setelah 3x koreksi
                        │
                        ▼
                CM Takeover (wajib)
                ├── Mode 1: System edit (TipTap editor)
                └── Mode 2: File upload (.docx)
```

**Version tracking:**
- Setiap submit PIC RS → create record di `wpa_pks_draft_versions` (v1, v2, v3, v4)
- `content_html` (sekarang) / `google_doc_version_id` (setelah migrasi Google Docs)
- `catatan_cm` — catatan koreksi CM per version
- `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`

---

## Notification Trigger Points

| Event | Penerima | Method |
|---|---|---|
| PIC RS submit pengajuan | CM di cabang terkait | in-app + email |
| CM advance tahap | Handler tahap berikutnya | in-app + email |
| CM return draft (koreksi) | PIC RS | in-app + email |
| CM takeover draft | PIC RS (notif "diambil alih") | in-app + email |
| Kabid approve | Legal RS (untuk review) | in-app + email |
| Legal RS approve | Kabid (untuk TTD) | in-app + email |
| PKS berakhir dalam 3 bulan | PIC RS + CM + Kabid | in-app + email + dashboard badge |
| Adendum masal baru tersedia | Semua PIC RS | in-app + email |
| CM group-action adendum masal | Semua PIC RS terkait | in-app + email |
| Dropping pusat baru | CM + Kabid cabang terkait | in-app + email |

---

## Data Model (simplified)

```sql
wpa_pipeline
  ├── id (uuid)
  ├── jenis_pipeline (text)         -- pks_baru, perpanjangan, dll
  ├── faskes_id (uuid)              -- FK ke wpa_faskes
  ├── kantor_cabang_id (uuid)       -- FK ke wpa_kantor_cabang
  ├── current_tahap (text)          -- diajukan, ditinjau_kajian_tarif, ...
  ├── status (text)                 -- in_progress, cancelled, completed
  ├── initiated_by (uuid)           -- FK ke wpa_users (PIC RS)
  ├── data_jsonb (jsonb)            -- placeholder values (81 field)
  ├── template_id (uuid)            -- FK ke wpa_pks_template
  ├── google_doc_id (text)          -- [AFTER MIGRATION] ID Google Doc
  ├── google_doc_url (text)         -- [AFTER MIGRATION] URL Google Doc
  ├── pks_id (uuid)                 -- FK ke wpa_pks (hasil final)
  ├── cancelled_at, cancelled_by
  ├── completed_at
  ├── created_at, updated_at

wpa_pks
  ├── id, faskes_id, kantor_cabang_id
  ├── nomor_pks_pihak_pertama, nomor_pks_pihak_kedua
  ├── tanggal_mulai, tanggal_akhir
  ├── status (aktif, berakhir, nonaktif)
  ├── data_jsonb (jsonb)            -- final placeholder values
  ├── file_docx_path (text)         -- [BEFORE] path di Supabase Storage
  ├── google_doc_id (text)          -- [AFTER MIGRATION]
  ├── google_doc_url (text)         -- [AFTER MIGRATION]
  ├── created_at, updated_at

wpa_pks_template
  ├── id, jenis_pipeline, nama, version
  ├── file_docx_path (text)         -- template .docx di Supabase Storage
  ├── google_doc_template_id (text) -- [AFTER MIGRATION] template ID Google Docs
  ├── placeholders (jsonb)          -- array 81 placeholder definition
  ├── is_active (boolean)
  ├── created_by, created_at

wpa_pks_draft_versions
  ├── id, pks_id
  ├── version (int)                 -- 1, 2, 3, 4
  ├── content_html (text)           -- [BEFORE] HTML dari mammoth
  ├── google_doc_version_id (text)  -- [AFTER MIGRATION] revision ID Google Docs
  ├── catatan_cm (text)
  ├── submitted_by, submitted_at
  ├── reviewed_by, reviewed_at
  ├── review_status (text)          -- pending, approved, returned, taken_over

wpa_tahap_config
  ├── jenis_pipeline, tahap, urutan, is_wajib
  ├── default_sla_days, handler_role
  ├── description

wpa_dokumen_pengajuan
  ├── id, pipeline_id, jenis, label
  ├── file_path (Supabase Storage)
  ├── uploaded_by, uploaded_at

wpa_pengajuan_dokumen
  ├── (legacy table for tracking upload state)
```

---

## API Endpoints (pipeline-related)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/pipeline/list` | GET | List pipeline dengan filter role |
| `/api/pipeline/detail/[id]` | GET | Detail pipeline (fault-tolerant select) |
| `/api/pipeline/transition` | POST | Advance to next tahap |
| `/api/pipeline/takeover` | POST | PP ambil alih tugas dari CM |
| `/api/pipeline/takeover-toggle` | POST | Toggle takeover status |
| `/api/pengajuan-baru/create` | POST | PIC RS create pengajuan baru |
| `/api/pengajuan-draft/create` | POST | Save draft pengajuan |
| `/api/pengajuan-draft/submit` | POST | Submit pengajuan (validate dokumen) |
| `/api/pengajuan-dokumen/list` | GET | List dokumen per pipeline |
| `/api/perpanjangan/create` | POST | Create perpanjangan + auto-clone data |
| `/api/adendum/create` | POST | Create adendum |
| `/api/adendum-masal/list-templates` | GET | List template adendum masal |
| `/api/adendum-masal/create` | POST | PIC RS submit adendum masal |
| `/api/adendum-masal/list-pending` | GET | List pending adendum masal untuk CM |
| `/api/adendum-masal/group-action` | POST | CM group approve/reject |
| `/api/adendum-masal/detail` | GET | Detail adendum masal |
| `/api/cm/pks-baru/create` | POST | CM onboarding faskes baru (create PIC RS user) |
| `/api/drafting/start` | POST | Start drafting session |
| `/api/drafting/generate` | POST | [BEFORE] Generate HTML via mammoth |
| `/api/drafting/save-version` | POST | Save draft version |
| `/api/drafting/versions` | GET | List versions |
| `/api/drafting/review` | POST | CM approve/return draft |
| `/api/drafting/takeover` | POST | CM takeover draft |
| `/api/drafting/version/[id]` | GET | Detail version |
| `/api/dropping-pusat/create` | POST | Create dropping |
| `/api/dropping-pusat/faskes-list` | GET | List faskes untuk dropping |

---

## Migration to Google Docs (impact ke pipeline)

Setelah migrasi, yang berubah di pipeline:

1. **Tahap `drafting_pks` / `drafting_adendum`:**
   - PIC RS klik "Generate ke Google Docs" → Apps Script clone template + replace placeholder → return `google_doc_url`
   - PIC RS klik URL → buka Google Docs → edit langsung (WYSIWYG native)
   - PIC RS klik "Submit untuk Review" → set `google_doc_id` di `wpa_pks_draft_versions`, advance tahap
   - CM buka link Google Docs → nyalakan Suggesting Mode → koreksi inline + comments
   - CM klik "Approve" → advance tahap. Atau "Return with catatan" → set `catatan_cm`, balik ke PIC RS
   - CM Takeover: langsung edit di Google Docs (mode editor) atau set `google_doc_id` ke doc baru yang CM upload

2. **Tahap `tanda_tangan`:**
   - Kabid klik "Download .docx" → redirect ke Google Docs export URL
   - Print, TTD basah, scan upload ke Supabase Storage (kolom `signed_pdf_path`)

3. **Yang TIDAK berubah:** state machine, transition logic, validation, notification, audit log

Lihat `docs/10_MIGRATION_PLAN.md` untuk detail step-by-step migrasi.
