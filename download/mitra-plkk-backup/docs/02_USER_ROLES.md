# 02 — User Roles & Permission Matrix

## 6 Role Aplikasi

| Role | Enum value | Lokasi | Multi-tenant? |
|---|---|---|---|
| Super Admin | `super_admin` | Kantor Pusat | Lihat semua cabang |
| Case Manager | `case_manager` | Per kantor cabang | Hanya cabang sendiri |
| Kepala Bidang | `kepala_bidang` | Per kantor cabang | Hanya cabang sendiri |
| Penata Pelayanan | `penata_pelayanan` | Per kantor cabang | Hanya cabang sendiri |
| PIC RS | `pic_rs` | Di faskes (external) | Hanya faskes sendiri |
| Legal RS | `legal_rs` | Di faskes (external, RS besar) | Hanya faskes sendiri |

> **Catatan DB:** Enum `wpa_user_role` di schema awal hanya punya 5 value (`admin_kantor`, `case_manager`, `kepala_bidang`, `pic_rs`, `legal_rs`). Tapi `admin_kantor` sudah deprecated (dihapus dari z.enum di code), dan `super_admin` + `penata_pelayanan` ditambahkan via `ALTER TYPE` (lihat `sql/00_master_schema_consolidated.sql`).

---

## Detail per Role

### 1. Super Admin (`super_admin`)

**Lokasi:** Kantor Pusat BPJS Ketenagakerjaan
**Akses:** Semua cabang + master data

**Tugas:**
- Manage kantor cabang (CRUD + batch import via Excel)
- Manage user (CRUD + batch import + reset password + print slip kredensial)
- Manage template PKS (upload + toggle active/inactive + view placeholders)
- Manage tarif acuan standar (75+ item, 2 mode)
- Manage AI API keys (multi-provider, default, reset quota)
- Lihat audit log semua user
- App settings (allow self-register, default PKS duration, reminder months)
- Manage dropping pusat (hapus faskes dari daftar PLKK cabang tertentu)

**Halaman:**
- `/super_admin` — dashboard action-oriented
- `/super_admin/kantor` — list + CRUD kantor cabang
- `/super_admin/kantor/[id]` — detail kantor + tab users
- `/super_admin/users` — list + CRUD user
- `/super_admin/template` — manage template PKS
- `/super_admin/pengajuan` — lihat semua pengajuan lintas cabang
- `/super_admin/audit` — audit log
- `/super_admin/settings` — app settings

---

### 2. Case Manager / CM (`case_manager`)

**Lokasi:** Per kantor cabang BPJS
**Akses:** Hanya cabang sendiri + semua faskes yang dikelola cabang itu
**Nama field di DB:** `full_name` (contoh: "Rohaya Hartisari" untuk cabang Cirebon)

**Tugas utama:**
- Front-liner pengelolaan pipeline PKS
- Review surat pengajuan dari PIC RS
- Kajian tarif (review hasil pattern scan + AI second opinion)
- Kredensialing (asesmen mandiri / visitasi jika red flag)
- Review draft PKS dari PIC RS (3x koreksi + takeover bila perlu)
- Group review untuk adendum masal
- Manage faskes master (CRUD + batch upload + batch select + print kredensial)
- Manage tarif acuan untuk faskes di cabangnya
- Manage dokumen operasional (surat menyurat post-PKS)
- Onboarding faskes baru (CM create user PIC RS, set `can_submit_pks_baru` flag)

**Halaman:**
- `/case_manager` — dashboard action-oriented
- `/case_manager/onboarding` — onboarding faskes baru (CM create user PIC RS)
- `/case_manager/pks-baru` — list pipeline pks_baru di cabangnya
- `/case_manager/pks` — list semua PKS (active + history)
- `/case_manager/pks/new` — buat PKS baru (rare, biasanya PIC RS yang submit)
- `/case_manager/perpanjangan` — list pipeline perpanjangan
- `/case_manager/adendum` — list pipeline adendum (harga + layanan + perubahan data)
- `/case_manager/adendum-masal` — group review adendum masal
- `/case_manager/dropping` — dropping pusat
- `/case_manager/tarif` — manage tarif acuan + scan + AI review
- `/case_manager/faskes` — manage faskes master (CRUD + batch)
- `/case_manager/dokumen-operasional` — surat menyurat post-PKS
- `/case_manager/tugas` — tugas saya (individual + adendum masal + dropping pusat)
- `/case_manager/tugas-cabang` — tugas semua CM di cabang (kalau multi-CM)
- `/case_manager/settings` — AI API keys (CM bisa set sendiri)

---

### 3. Kepala Bidang / Kabid (`kepala_bidang`)

**Lokasi:** Per kantor cabang
**Akses:** Hanya cabang sendiri
**Nama field di DB:** contoh "Fitri Risnawati" untuk cabang Cirebon

**Tugas utama:**
- Approver 4-eyes untuk draft PKS (tahap `approval_kabid`)
- Penanda tangan PKS final (tahap `tanda_tangan`)
- Lihat approval queue
- Lihat reminder PKS berakhir
- Lihat laporan pipeline (overview cabang)
- Receive notification untuk PKS yang perlu approval

**Halaman:**
- `/kepala_bidang` — dashboard action-oriented
- `/kepala_bidang/approval` — approval queue
- `/kepala_bidang/tugas` — tugas saya
- `/kepala_bidang/pengajuan` — semua pengajuan
- `/kepala_bidang/pks` — semua PKS
- `/kepala_bidang/dropping` — dropping pusat (approval)
- `/kepala_bidang/onboarding` — onboarding faskes baru (oversight)
- `/kepala_bidang/tarif` — view-only tarif
- `/kepala_bidang/dokumen` — dokumen operasional
- `/kepala_bidang/reminder` — reminder PKS berakhir
- `/kepala_bidang/laporan` — laporan analytics
- `/kepala_bidang/dokumen-operasional` — view
- `/kepala_bidang/settings` — AI keys (bisa set sendiri)

---

### 4. Penata Pelayanan / PP (`penata_pelayanan`)

**Lokasi:** Per kantor cabang
**Akses:** Hanya cabang sendiri
**Nama field di DB:** contoh "Agung Wahyudi", "Luhur Adiastika" untuk cabang Cirebon (2 PP)

**Tugas utama:**
- Ambil alih tugas dari CM kalau CM berhalangan (tahap `ditinjau_kajian_tarif`)
- Pembinaan & sosialisasi ke faskes (Fase 6 — belum diimplemen)
- Visitasi faskes (kalau red flag dari kredensialing)
- Lapor faskes bermasalah ke CM
- Manage dokumen operasional (surat menyurat)

**Halaman:**
- `/penata_pelayanan` — dashboard action-oriented
- `/penata_pelayanan/tugas` — tugas saya (dengan "Ambil Alih" button)
- `/penata_pelayanan/tugas-cabang` — semua tugas cabang
- `/penata_pelayanan/faskes` — view-only faskes
- `/penata_pelayanan/dokumen-operasional` — manage surat menyurat

---

### 5. PIC RS (`pic_rs`)

**Lokasi:** Di faskes (RS/Klinik) — external ke BPJS
**Akses:** Hanya faskes sendiri + pengajuannya sendiri
**Nama field di DB:** ditetapkan saat CM onboarding faskes

**Tugas utama:**
- Submit pengajuan: pks_baru, perpanjangan, adendum (harga/layanan/perubahan data), adendum masal
- Upload dokumen wajib (7 file untuk pks_baru, 2-3 file untuk adendum)
- Isi form placeholder 81 field saat drafting
- Upload tarif dalam bentuk Excel untuk di-scan
- Edit faskes data sendiri (nama, alamat, PJ, bank) — **PENDING**, sekarang masih via CM
- Lihat tracking pengajuan (real-time status)
- Lihat reminder PKS berakhir (countdown di dashboard)
- Submit perpanjangan (auto-clone data dari PKS lama)

**Halaman:**
- `/pic_rs` — dashboard action-oriented dengan countdown PKS
- `/pic_rs/ajukan-baru` — pilih jenis pengajuan (3 kartu: PKS Baru/Adendum/Perpanjangan + sub-adendum + Adendum Masal)
- `/pic_rs/ajukan-baru/pks-baru` — form pengajuan PKS Baru
- `/pic_rs/ajukan-baru/adendum` — form pengajuan adendum
- `/pic_rs/ajukan-baru/perpanjangan` — form pengajuan perpanjangan
- `/pic_rs/pengajuan` — list semua pengajuan
- `/pic_rs/adendum-masal/[templateId]` — submit adendum masal untuk template tertentu
- `/pic_rs/pks` — list semua PKS aktif
- `/pic_rs/perpanjangan` — pengajuan perpanjangan dengan countdown
- `/pic_rs/adendum` — list adendum
- `/pic_rs/dropping` — lihat dropping pusat (read-only)
- `/pic_rs/dokumen` — dokumen operasional
- `/pic_rs/tarif` — upload tarif untuk scan

---

### 6. Legal RS (`legal_rs`)

**Lokasi:** Di faskes (khusus RS besar yang punya tim legal) — external
**Akses:** Hanya faskes sendiri

**Tugas utama:**
- Review draft PKS dari sisi hukum RS (tahap `review_legal_rs`)
- Approve / return dengan catatan
- Lihat dokumen yang sudah signed
- Audit trail review

**Halaman:**
- `/legal_rs` — dashboard action-oriented
- `/legal_rs/review` — queue review draft
- `/legal_rs/signed` — list dokumen sudah signed
- `/legal_rs/dropping` — view dropping
- `/legal_rs/dokumen` — dokumen operasional
- `/legal_rs/audit` — audit trail

---

## Permission Matrix

| Aksi | Super Admin | CM | Kabid | PP | PIC RS | Legal RS |
|---|---|---|---|---|---|---|
| **Master data** | | | | | | |
| Create kantor cabang | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit kantor cabang | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create user | ✅ | ✅ (PIC RS di cabangnya saja) | ❌ | ❌ | ❌ | ❌ |
| Reset password user | ✅ | ✅ (PIC RS di cabangnya) | ❌ | ❌ | ❌ | ❌ |
| Print slip kredensial | ✅ (all) | ✅ (cabang sendiri) | ❌ | ❌ | ❌ | ❌ |
| **Faskes** | | | | | | |
| Create faskes | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit faskes | ✅ | ✅ | ❌ | ❌ | (pending self-service) | ❌ |
| Batch import faskes | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Pipeline** | | | | | | |
| Submit pengajuan | ❌ | ❌ (jarang, CM create user PIC RS) | ❌ | ❌ | ✅ (faskes sendiri) | ❌ |
| Cancel pengajuan | ✅ | ✅ | ❌ | ❌ | ✅ (di tahap `diajukan` / `ditinjau`) | ❌ |
| Review surat (tahap ditinjau_kajian_tarif) | ✅ | ✅ | ❌ | ✅ (ambil alih) | ❌ | ❌ |
| Run tarif scan | ✅ | ✅ | view | ❌ | ❌ | ❌ |
| AI second opinion | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kredensialing | ✅ | ✅ | ❌ | ✅ (ambil alih) | ❌ | ❌ |
| Drafting (isi placeholder + edit dokumen) | ✅ | ✅ (review + takeover) | ❌ | ❌ | ✅ | ❌ |
| Approve draft (tahap approval_kabid) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Review legal (tahap review_legal_rs) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| TTD final (tahap tanda_tangan) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Adendum masal** | | | | | | |
| Submit form | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Group approve/reject | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Tarif acuan** | | | | | | |
| Create tarif acuan | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Batch import tarif | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View tarif acuan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **AI Keys** | | | | | | |
| Manage AI API keys | ✅ | ✅ (per cabang) | ✅ (per cabang) | ❌ | ❌ | ❌ |
| **Audit** | | | | | | |
| View audit log (all) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View audit log (cabang) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View audit log (faskes) | ✅ | ✅ | ✅ | ✅ | ✅ (faskes sendiri) | ✅ (faskes sendiri) |

---

## Auth & Session

- **Method:** Email + password (hashed bcrypt di server)
- **Session:** Signed JWT in HTTP-only cookie (`wpa_session`)
- **Session cache:** `React.cache()` di server components untuk avoid re-fetch getSession
- **Middleware:** `src/middleware.ts` proteksi semua route kecuali `/login`, `/api/auth/*`, `/api/health`
- **Login redirect:** Setelah login, redirect ke `/[role]/` (mis. `/case_manager`)
- **Logout:** Hapus cookie + redirect ke `/login`

---

## Multi-Tenant Implementation

- Setiap user BPJS punya `kantor_cabang_id` (CM, Kabid, PP, Super Admin punya akses cross-cabang)
- PIC RS & Legal RS punya `faskes_id` (bukan kantor_cabang_id)
- RLS (Row Level Security) di Supabase filter berdasarkan role + kantor_cabang_id / faskes_id
- Super Admin bypass RLS via `service_role` key

---

## Catatan Penting untuk AI/Developer

1. **`admin_kantor` role sudah deprecated** — di enum DB masih ada tapi di code z.enum sudah dihapus. Jangan tambah user dengan role ini.
2. **`super_admin` tidak ada di enum asli** — ditambah via `ALTER TYPE` di migration terpisah. Pastikan migration `wpa_add_super_admin_role.sql` (atau sejenis) sudah di-run.
3. **`penata_pelayanan` juga ditambah via ALTER TYPE** — sama dengan super_admin.
4. **PIC RS dibuat oleh CM**, bukan self-register (kecuali setting `allow_self_register_pic_rs = true`, default false).
5. **CM dibuat oleh Super Admin** di kantor cabang tertentu.
6. **Setiap faskes punya 1 PIC RS utama**, tapi bisa punya multiple (PIC RS + Legal RS untuk RS besar).
