# 01 — Product Overview

## Apa itu Mitra PLKK

**Mitra PLKK** adalah aplikasi web internal BPJS Ketenagakerjaan untuk mengelola **siklus hidup PKS (Perjanjian Kerja Sama)** antara BPJS (sebagai Pihak Pertama) dan Faskes Pusat Layanan Kecakapan Kerja / PLKK (sebagai Pihak Kedua). PKS mengatur tarif layanan kecelakaan kerja, kewajiban masing-masing pihak, dan jangka waktu kerja sama.

PLKK = fasilitas kesehatan (RS, Klinik) yang menjadi rujukan tetap untuk kasus kecelakaan kerja peserta BPJS Ketenagakerjaan. Tanpa PKS aktif, faskes tidak bisa mengklaim biaya layanan ke BPJS.

---

## Masalah yang Diselesaikan

### 1. PKS management manual & tersebar
Sebelum Mitra PLKK, pengelolaan PKS dilakukan via:
- Email antar PIC RS dan CM BPJS
- Spreadsheet Excel untuk tracking tanggal & nomor PKS
- Word dokumen yang diedit bolak-balik via email attachment
- Folder fisik di kantor cabang untuk arsip

Akibatnya:
- Tidak ada visibility status PKS real-time
- Sering telat perpanjangan (PKS expired → faskes tidak bisa klaim)
- Sulit audit siapa sudah/approve apa
- Versi dokumen berantakan (final_v2_revisi_final.docx syndrome)

### 2. Tidak ada standardisasi tarif
Setiap faskes mengajukan tarif sendiri-sendiri. CM review manual tanpa acuan baku. Akibatnya:
- Tarif untuk item yang sama bisa beda 2x lipat antar faskes
- Tidak ada deteksi outlier otomatis
- Negosiasi tarif subjektif dan lambat

### 3. Adendum masal tidak scalable
Saat ada kebijakan baru (mis. penambahan jenis layanan Covid), BPJS harus kirim adendum ke ratusan faskes. Manual, ini bisa makan berbulan-bulan.

### 4. Tidak ada reminder PKS berakhir
PKS berjangka waktu 3 tahun. Tanpa sistem reminder, banyak faskes baru sadar PKS expired ketika klaim ditolak.

---

## Solusi Mitra PLKK

### 1. Workflow pipeline terpusat
Setiap PKS (baru/perpanjangan/adendum) masuk ke pipeline 6 tahap dengan:
- Status real-time (tahap berapa, siapa handler, SLA berapa hari)
- Notification otomatis ke role terkait
- Audit log (siapa melakukan apa kapan)
- Cancel/return mechanism

### 2. Sistem tarif acuan + AI scan
- **Bank Tarif Standar:** 75+ item layanan kecelakaan kerja dengan ceiling tarif per provinsi
- **2 mode acuan:** (a) Provinsi ceiling (default), (b) Rata-rata Daerah (survey 3+ RS terdekat)
- **Pattern scan:** Excel tarif faskes → fuzzy match 3-layer (exact/contains/alias) → classify (≤5% WAJAR, 5-20% REVIEW, >20% TIDAK WAJAR)
- **AI review (opsional):** second opinion naratif via multi-provider AI (Gemini default, auto-rotate ke OpenAI/Zhipu/DeepSeek/Qwen kalau quota habis)

### 3. Adendum masal
PIC RS submit form placeholder → CM group review (ceklis multi → setuju/tolak bareng) → generate PDF untuk TTD basah. 1 aksi CM untuk 50 faskes sekaligus.

### 4. Dashboard action-oriented
Setiap role lihat dashboard yang langsung kasih konteks: "Ini 5 PKS yang perlu Anda aksi hari ini". Minim klik, button context-aware per tahap.

### 5. Auto-clone perpanjangan
Saat PIC RS ajukan perpanjangan, sistem otomatis clone 80% data dari PKS lama (identitas faskes, bank, PJ). Yang di-reset: nomor PKS baru, tanggal, BA negosiasi. PIC RS tinggal isi 20% sisanya.

---

## Target User

Aplikasi dipakai oleh **6 role** di BPJS Ketenagakerjaan + pihak RS/Klinik (lihat `02_USER_ROLES.md` untuk detail):

| Role | Singkat | Lokasi | Tugas utama |
|---|---|---|---|
| Super Admin | SA | Kantor Pusat | Manage kantor cabang, user, app settings |
| Case Manager | CM | Per kantor cabang | Front-liner pengelola pipeline PKS |
| Kepala Bidang | Kabid | Per kantor cabang | Approval 4-eyes, TTD basah |
| Penata Pelayanan | PP | Per kantor cabang | Pembinaan, sosialisasi, visitasi |
| PIC RS | PIC | Di faskes | Submit pengajuan, isi data, upload dokumen |
| Legal RS | Legal | Di faskes (besar) | Review draft PKS dari sisi hukum RS |

**Skala pengguna:** 1 Super Admin + ~150 cabang × (1 CM + 1 Kabid + 1 PP) = ~450 user BPJS. + ~3000 PIC RS + ~300 Legal RS = total ~3750 user aktif potensial.

---

## Scope Produk

### In scope (sudah / sedang dibangun):

1. **Auth & RBAC** — login email+password, 6 role, multi-tenant (per kantor cabang)
2. **Master data** — kantor cabang, faskes, user, tarif acuan, template PKS
3. **Pipeline workflow** — 7 jenis pengajuan × 6 tahap state machine
4. **Dokumen pendukung** — upload/preview/download 7 jenis dokumen wajib per pengajuan
5. **Drafting PKS** — form placeholder 81 field + generate dokumen + version tracking
6. **Review & approval** — CM review draft + Kabid approve + Legal RS review
7. **Tarif scanning** — pattern scan + AI review + comparison vs acuan
8. **Adendum masal** — template-driven, group review
9. **Perpanjangan** — auto-clone data + reminder 3 bulan sebelum expired
10. **Dropping Pusat** — kantor pusat hapus faskes dari daftar PLKK cabang
11. **Dokumen operasional** — surat menyurat post-PKS (SP, BA visitasi, dll)
12. **Audit log** — semua aksi tercatat
13. **Notification** — in-app + email (via Supabase function)
14. **Bot receptionist** — chatbot FAQ di login page
15. **Dashboard action-oriented** — per role, dengan context-aware buttons
16. **Profile self-service** — edit nama, no HP, foto, ganti password
17. **Slip kredensial** — print kredensial user (batch atau per-user)
18. **Batch import** — kantor, user, faskes, tarif (Excel upload)

### Out of scope (tidak dibangun):

1. **e-Signature / TTD digital** — TTD tetap basah (fisik)
2. **Integrasi sistem BPJS existing** (kecuali Supabase project)
3. **Mobile app native** — web responsive saja
4. **Pelaporan ke regulator** — outside the system
5. **Pembayaran klaim** — ini domain sistem lain
6. **AI untuk drafting dokumen** — AI hanya untuk kajian tarif, bukan generate teks PKS
7. **Multi-bahasa** — Bahasa Indonesia saja

---

## Stakeholder & Decision Makers

| Stakeholder | Peran |
|---|---|
| Kepala Kantor Cabang | Sponsor utama, TTD PKS final |
| Kabid Pelayanan | Approver PKS (4-eyes) |
| CM (Case Manager) | User utama sehari-hari |
| Tim Legal BPJS Pusat | Konsultasi untuk template PKS & kepatuhan |
| Tim Legal RS | Review dari sisi hukum RS |
| PIC RS / Direktur RS | Submit pengajuan + TTD dari sisi faskes |
| Super Admin BPJS Pusat | Manage master data & user management |

---

## Metrics Sukses

| Metric | Target | Cara ukur |
|---|---|---|
| Waktu rata-rata proses PKS (submit → TTD) | ≤ 30 hari | Audit log pipeline |
| PKS telat perpanjangan | < 5% | Dashboard Kabid |
| Outlier tarif terdeteksi | 100% otomatis via scan | Tarif scan report |
| Adendum masal selesai | < 7 hari untuk 50 faskes | Group review timestamp |
| User satisfaction (CM) | ≥ 4/5 | Survey berkala |
| Audit trail completeness | 100% aksi tercatat | Audit log query |

---

## Roadmap (post-migration)

Setelah migrasi Google Docs + Apps Script selesai:

1. **Fase 6 — Pembinaan & Sosialisasi** (PP lapor faskes → CM decision → SP/visitasi/sosialisasi)
2. **PIC RS self-service editing faskes data** (sekarang harus via CM)
3. **Mobile PWA optimization** (sekarang responsive tapi belum PWA)
4. **Laporan & analytics** untuk Kabid (sekarang masih basic)
5. **Integrasi email notification** dengan SMTP BPJS (sekarang via Supabase function)
6. **Multi-cabang CM** (sekarang 1 CM = 1 cabang, mungkin perlu 1 CM multi-cabang)
