---
Task ID: BLUEPRINT-001
Agent: main
Task: Finalisasi blueprint WPA (skema DB, role, fitur, halaman, integrasi) untuk approval user sebelum mulai kode.

Work Log:
- Menggabungkan temuan AUDIT-001 (resource) + AUDIT-002 (pola magang-cerdas-pwa) + permintaan user terbaru.
- Menambahkan modul ONBOARDING FASKES BARU (pengajuan → kredensialing → drafting PKS) yang sebelumnya belum ada di brief awal.
- Merancang 4 role dengan "empati peran" — setiap role punya dashboard yang berbeda sesuai prioritas kerjanya.
- Menambahkan bot resepsionis berbasis Groq dengan fallback ke rule-based jika API 403.

Stage Summary:
- Skema DB WPA: 26 tabel baru (prefix `wpa_`) — tidak mengganggu 31 tabel magang-cerdas-pwa.
  Termasuk 4 tabel baru untuk modul Adendum Dropping Pusat (wpa_dropping_pusat, wpa_dropping_pusat_target, wpa_dropping_pusat_progress_log, wpa_dropping_pusat_reminder_log).
- 5 role: admin_kantor (root), case_manager, kepala_bidang (BPJS); pic_rs, legal_rs (eksternal RS).
- Modul utama: Onboarding Faskes → Drafting PKS → Adendum Adaptif → Adendum Harga → Adendum Dropping Pusat → Perpanjangan → Bank Tarif → Komparasi → Reminder → Bot Resepsionis.
- Groq token 403 — bot akan pakai fallback rule-based sampai token baru diberikan.
- Akan minta konfirmasi user untuk 3 keputusan terakhir (lihat bagian "Konfirmasi Akhir").

=== KEPUTUSAN USER SUDAH DIPILIH ===
1. Supabase: PROJECT BARU (user akan buatkan) — tunggu URL+key
2. Token Groq: pakai yang ada dulu (403 → fallback rule-based)
3. Repo: wpa-pks-bpjskaker (OK)
4. Auth: NextAuth Credentials Provider + bcrypt + JWT httpOnly (dapat diubah ke Supabase Auth nanti)
5. Multi-tenant: desain multi-kantor-cabang dari awal, toggle on/off, fokus 1 kantor dulu
6. PIC RS & Legal RS: admin yang buatkan akun awal + toggle self-register on/off
7. Export: DOCX + PDF (puppeteer-core + chrome-aws-lambda atau @sparticuz/chromium untuk Vercel)
8. Bot: widget pojok kanan

=== RINCIAN BLUEPRINT ===

A. SKEMA DATABASE (22 tabel baru, prefix wpa_)

  Tenant & Org:
  - wpa_kantor_cabang (id, kode, nama, alamat, kota, telp, email, is_active, created_at)
  - wpa_app_settings (id singleton=1, allow_self_register_pic_rs, allow_self_register_legal_rs, groq_enabled, default_pks_duration_months, reminder_months_before=3, …)

  Users & Auth:
  - wpa_users (id uuid, kantor_cabang_id FK, email unique, password_hash bcrypt, full_name, role enum['admin_kantor','case_manager','kepala_bidang','pic_rs','legal_rs'], phone, is_active, last_login_at, created_by, created_at, updated_at)
  - wpa_password_resets (id, user_id, token_hash, expires_at, used_at)
  - wpa_audit_logs (id, user_id, action, entity_type, entity_id, before_jsonb, after_jsonb, ip, ua, created_at)

  Master Faskes:
  - wpa_faskes (id, kode, nama, jenis enum['RS','Klinik','Puskesmas','PraktikMandiri'], bentuk, alamat, kota, provinsi, telp, email, npwp, penanggung_jawab_nama, penanggung_jawab_jabatan, penanggung_jawab_phone, bank_name, bank_cabang, bank_rekening_number, bank_rekening_name, status enum['draft','pengajuan','kredensialing','negosiasi','aktif','nonaktif','ditolak','berakhir'], created_at, updated_at)
  - wpa_faskes_credentials (id, faskes_id, jenis_dokumen enum['SIP','STR','Akta','IzinOperasional','Lainnya'], nomor, tanggal_terbit, tanggal_berakhir, file_url, verified bool, verified_by, verified_at)

  Onboarding Faskes (PENGAJUAN → KREDENSIALING → DRAFTING):
  - wpa_faskes_pengajuan (id, faskes_id, kantor_cabang_id, tanggal_pengajuan, surat_pengajuan_url, perihal, status enum['diajukan','ditinjau','kredensialing','layak','tidak_layak','drafting','selesai_drafting','ditandatangani','ditolak'], assigned_case_manager_id, assigned_legal_id, catatan, created_at, updated_at)
  - wpa_faskes_kredensialing (id, pengajuan_id, tahap enum['tinjauan_surat','verifikasi_dokumen','visitasi','rekomendasi'], tanggal_mulai, tanggal_selesai, hasil enum['pending','memenuhi','tidak_memenuhi','perlu_perbaikan'], catatan, dokumen_url, performed_by, created_at)
  - wpa_faskes_kredensialing_checklist (id, kredensialing_id, item, is_done, catatan, done_by, done_at)

  PKS:
  - wpa_pks (id, kode_pks_pihak_pertama, kode_pks_pihak_kedua, faskes_id, kantor_cabang_id, jenis enum['pks_baru','adendum','perpanjangan'], parent_pks_id nullable, template_version, status enum['draft','negosiasi','review_legal','final','ditandatangani','berakhir','diakhiri'], tanggal_mulai, tanggal_berakhir, tanggal_tanda_tangan, kota_tanda_tangan, data_jsonb jsonb, file_docx_url, file_pdf_url, created_by, created_at, updated_at, signed_at)
  - wpa_pks_template (id, kode, nama, version, file_docx_url, placeholders jsonb, pasal_count, lampiran_count, is_active, uploaded_by, uploaded_at)
  - wpa_pks_template_placeholder (id, template_id, key e.g. NAMA_FASKES, label, tipe enum['text','date','number','currency','textarea','select'], required, urutan, kategori)
  - wpa_pks_versions (id, pks_id, versi_int, perubahan, snapshot_jsonb, created_by, created_at)
  - wpa_pks_signatures (id, pks_id, pihak enum['pertama','kedua'], signer_user_id, signer_name, signer_jabatan, signed_at, signature_url, ip, ua)

  Adendum:
  - wpa_pks_adendum (id, pks_id, jenis enum['ayat','harga','dropping_pusat'], kampanye_dropping_id nullable FK, template_id_new nullable, perubahan_jsonb jsonb, alasan, status enum['draft','negosiasi','review_legal','final','ditandatangani','ditolak','kedaluwarsa'], tanggal_adendum, nomor_adendum, deadline_at nullable, created_by, created_at, updated_at, signed_at)
  - wpa_pks_adendum_diff (id, adendum_id, ayat_path, before_text, after_text, action enum['tambah','ubah','hapus'])

  # === NEW: ADENDUM DROPPING PUSAT (broadcast wajib ke semua faskes aktif + deadline) ===
  - wpa_dropping_pusat (id, kode_dropping e.g. DROP-2026-001, judul, keterangan, template_lama_id FK, template_baru_id FK, tanggal_terima_dari_pusat, deadline_tanda_tangan date, deadline_draft date, jenis enum['penambahan_ayat','pengurangan_ayat','perubahan_ayat','perubahan_struktur','ganti_template_total'], perubahan_ringkas text, status enum['diajukan','aktif','selesai','kedaluwarsa','ditunda'], target_faskes_count int, completed_count int default 0, created_by, created_at, updated_at, closed_at nullable)
    -- Catatan: ini kampanye turunan dari kantor pusat. Admin upload template baru + set deadline, sistem broadcast ke semua faskes AKTIF yang punya PKS.

  - wpa_dropping_pusat_target (id, dropping_id FK, pks_id FK UNIQUE per dropping, faskes_id FK, kantor_cabang_id FK, assigned_case_manager_id nullable, assigned_legal_id nullable, status enum['pending','drafting','review_legal_bpjs','review_legal_rs','final','ditandatangani','ditolak','kedaluwarsa'], tanggal_mulai, tanggal_selesai nullable, adendum_id nullable FK one-to-one ke wpa_pks_adendum, catatan, reminder_count int default 0, last_reminder_at nullable, created_at, updated_at)
    -- Catatan: per faskes per dropping. Track progress masing-masing.

  - wpa_dropping_pusat_progress_log (id, dropping_target_id FK, action enum['assigned','started_draft','submitted_legal_bpjs','returned_legal_bpjs','submitted_legal_rs','returned_legal_rs','approved_legal','signed','rejected','expired','reminder_sent'], performed_by, catatan, snapshot_jsonb, created_at)
    -- Audit trail per target.

  - wpa_dropping_pusat_reminder_log (id, dropping_target_id FK, jenis enum['deadline_draft_7d','deadline_draft_3d','deadline_draft_1d','deadline_ttd_7d','deadline_ttd_3d','deadline_ttd_1d','overdue'], channel enum['in_app','email','whatsapp','bot'], sent_at, sent_to_user_id, message, created_at)
    -- Log reminder yang sudah dikirim, hindari duplikat.

  Tarif:
  - wpa_tarif_bank (id, faskes_id, kategori enum['kamar','operasi_kecil','operasi_sedang','operasi_besar','laboratorium','radiologi','tindakan_medis','rawat_inap','obat','admin','lainnya'], nama_item, satuan, tarif, tahun, sumber enum['negosiasi','ina_cbg','rs_pemerintah'], is_active, created_at, updated_at)
  - wpa_tarif_kewajaran_rule (id, kategori, min_percentile_5, max_percentile_95, std_dev_threshold, catatan, updated_at)
  - wpa_tarif_comparison (id, faskes_id, item, tarif_diusulkan, tarif_median_pas, selisih_percent, status enum['wajar','tinggi','rendah','ekstrem'], calculated_at, created_by)

  Reminder & Notifications:
  - wpa_reminders (id, pks_id, tanggal_reminder, jenis enum['3_bulan','1_bulan','2_minggu','habis'], status enum['pending','sent','done'], sent_at, created_at)
  - wpa_notifications (id, user_id, kantor_cabang_id, type, title, body, related_entity, related_id, is_read, read_at, created_at)

  Bot:
  - wpa_bot_sessions (id, user_id nullable, session_token, konteks_jsonb, created_at, updated_at, last_message_at)
  - wpa_bot_messages (id, session_id, role enum['user','assistant'], content, created_at)

B. ROLE & EMPATI PERAN (Dashboard berbeda per role)

  1. CASE MANAGER BPJS KETENAGAKERJAAN
     Prioritas: eksekusi harian
     Dashboard:
     - Card "Pengajuan Faskes menunggu tinjauan" (count + warna merah kalau >5)
     - Card "Kredensialing in progress" (count, next tahap)
     - Card "PKS draft aktif yang saya pegang" (list, persentase completion)
     - Card "Adendum perlu tindak lanjut" (list)
     - Card "Dropping Pusat Aktif" (count + progress bar % + deadline countdown warna)
     - Card "Dropping Pusat — yang saya pegang menunggu draft" (list + SLA timer)
     - Reminder 3 bulan warna merah/kuning/hijau
     - To-do harian (PKS yang harus di-follow up)
     - Aksi cepat: "Buat PKS baru", "Lanjutkan draft", "Buat adendum harga", "Proses Dropping Pusat"
     Tema warna: biru tua + putih (profesional, fokus)

  2. KEPALA BIDANG PELAYANAN BPJS KETENAGAKERJAAN
     Prioritas: monitoring & keputusan strategis
     Dashboard:
     - KPI bulanan: jumlah PKS aktif, akan berakhir 3 bulan, faskes baru pengajuan
     - Pipeline onboarding faskes (funnel: pengajuan → kredensialing → drafting → signed)
     - Card "Dropping Pusat Aktif" dengan progress ALL faskes (belum mulai / drafting / review / signed / overdue) — sort by deadline terdekat
     - Tabel adendum harga yang menunggu approval
     - Grafik tarif kewajaran (faskes vs median regional)
     - Tabel reminder 3 bulan dengan flag warna
     - Approval queue (PKS final menunggu tanda tangan / adendum final)
     Tema warna: hijau tosca + abu-abu (leadership, trust)

  3. PIC RS (Faskes)
     Prioritas: respon cepat ke BPJS, lengkapi dokumen
     Dashboard:
     - "Status PKS faskes saya" (1 card besar: aktif/berakhir/draft)
     - Tanggal berakhir + countdown (warna)
     - Dokumen yang perlu diunggah (kredensialing checklist)
     - Tagihan terkini & status verifikasi
     - Tombol "Ajukan Perpanjangan" (auto-fill dari PKS sebelumnya)
     - Tombol "Ajukan Adendum Harga"
     - Card "Dropping Pusat menunggu tindakan RS saya" (deadline countdown warna + tombol "Lihat & Proses")
     - Chat dengan case manager
     Tema warna: oranye hangat (keramahan, approachable)

  4. LEGAL RS / PIMPINAN RS
     Prioritas: review legal & sign-off
     Dashboard:
     - "PKS menunggu review legal" (list, SLA timer)
     - "Adendum menunggu review legal"
     - Card "Dropping Pusat menunggu review legal RS" (dengan deadline countdown)
     - Highlight perubahan pasal/ayat (diff view)
     - Highlight perubahan tarif (tabel komparasi)
     - Approve / reject dengan komentar
     - Riwayat dokumen yang sudah ditandatangani
     Tema warna: ungu gelap (formal, hukum)

  5. ADMIN KANTOR (root, hidden)
     - CRUD user (buat akun case_manager/kepala_bidang/pic_rs/legal_rs)
     - Toggle self-register on/off untuk PIC RS & Legal RS
     - CRUD kantor cabang (multi-tenant)
     - CRUD template PKS (upload .docx baru, parsing placeholder otomatis)
     - CRUD bank data tarif
     - Lihat audit log semua aktivitas
     Tema warna: abu-abu netral (backend, neutral)

C. MODUL ONBOARDING FASKES BARU (alur 5 tahap)

  Tahap 1: PENGAJUAN
  - Faskes unggah surat pengajuan + data dasar via form publik (atau admin inputkan)
  - Status: "diajukan" → notifikasi ke kepala_bidang
  - Sistem auto-assign ke case_manager dengan beban kerja paling ringan

  Tahap 2: TINJAUAN SURAT
  - Case manager cek kelengkapan dokumen
  - Bisa return ke faskes dengan catatan (notifikasi ke PIC RS)
  - Status: "ditinjau" → "kredensialing" (kalau lengkap)

  Tahap 3: KREDENSIALING
  - Checklist otomatis: SIP dokter, STR, Akta pendirian, Izin operasional, Surat BLU (kalau RS pemerintah), dll
  - Visitasi: form hasil kunjungan + foto + checklist fisik
  - Rekomendasi: layak / tidak layak / perlu perbaikan
  - Status: "kredensialing" → "layak" / "tidak_layak"

  Tahap 4: NEGOSIASI TARIFF
  - Faskes unggah penawaran tarif
  - Sistem auto-bandingkan dengan bank data tarif + INA-CBGs
  - Flag kewajaran: hijau (dalam 1 std dev) / kuning (1-2 std dev) / merah (>2 std dev)
  - Case manager + kepala bidang approve tarif final
  - Generate BA Negosiasi

  Tahap 5: DRAFTING PKS
  - Sistem auto-fill template PKS dengan data dari pengajuan + negosiasi
  - Case manager review & edit placeholder yang tersisa
  - Submit ke legal (BPJS) → legal (RS) → tanda tangan
  - Status: "drafting" → "ditandatangani" → PKS aktif

D. ADAPTIVE ADENDUM (responsif terhadap template baru dari kantor pusat)

  Saat admin upload template .docx baru:
  - Sistem parse semua {{PLACEHOLDER}} otomatis
  - Bandingkan dengan template lama: placeholder baru/hilang, pasal baru/hilang
  - Tampilkan diff visual (mirip GitHub diff)
  - Untuk setiap adendum ayat yang aktif di PKS existing, tampilkan mapping baru
  - Admin kasih label: "placeholder X baru = placeholder Y lama" (atau "tidak terpakai")
  - PKS existing tetap pakai template versi lama sampai adendum diaplikasikan
  - Adendum ayat dibuat otomatis dari diff template → review oleh case manager → legal

E. ADENDUM PERUBAHAN HARGA FASKES
  - Faskes/PIC RS ajukan perubahan tarif via form
  - Sistem auto-bandingkan dengan tarif lama + bank data + kewajaran
  - Generate draft adendum dengan perubahan tarif di lampiran II
  - Approval flow: case_manager → kepala_bidang → legal → signed

E2. ADENDUM DROPPING PUSAT (broadcast wajib + deadline) — NEW
   Skenario: Kantor pusat menerbitkan template baru (penambahan/pengurangan/perubahan ayat atau struktur). SEMUA faskes aktif WAJIB membuat adendum dengan DEADLINE yang sama.

   Mekanisme end-to-end:

   1) ADMIN KANTOR terima dropping dari pusat:
      - Upload template .docx BARU (digenerate placeholder otomatis)
      - Pilih template LAMA sebagai acuan (yang sedang dipakai PKS aktif)
      - Sistem auto-diff: daftar placeholder tambah/hapus, pasal tambah/hapus/ubah
      - Set DEADLINE DRAFT (mis. H+14 dari dropping) dan DEADLINE TANDA TANGAN (mis. H+30)
      - Set judul, keterangan, jenis perubahan
      - Pilih scope: semua faskes aktif / filter jenis faskes / filter kantor cabang
      - Klik "Broadcast" → sistem buat 1 row wpa_dropping_pusat + N row wpa_dropping_pusat_target (1 per PKS aktif)
      - Status dropping: "diajukan" → "aktif"

   2) AUTO-ASSIGN ke Case Manager:
      - Sistem auto-distribusikan target ke case_manager dengan beban kerja paling ringan (jumlah target aktif paling sedikit) di kantor cabang yang sama
      - Kalau belum ada case_manager, target tetap masuk tapi status "pending" + flag merah di dashboard kepala_bidang
      - Notifikasi in-app + email ke setiap case_manager yang dapat assignment

   3) CASE MANAGER proses per target:
      - Buka target → lihat diff template (lama vs baru) + auto-detect placeholder yang berubah
      - Sistem pre-fill data dari PKS lama ke template baru (placeholder yang sama nilainya disalin)
      - Untuk placeholder BARU yang belum ada nilainya: form input (highlight kuning)
      - Untuk placeholder HILANG: abaikan (otomatis di-drop)
      - Untuk pasal/ayat yang berubah: case manager review konteks, bisa edit teks adendum
      - Generate dokumen adendum (DOCX preview)
      - Submit ke LEGAL BPJS → status "review_legal_bpjs"

   4) LEGAL BPJS review:
      - Lihat diff ayat + diff placeholder + draft adendum
      - Approve → forward ke PIC RS / Legal RS
      - Reject dengan catatan → balik ke case_manager

   5) PIC RS / LEGAL RS review & sign:
      - Notifikasi ke PIC RS + Legal RS faskes terkait
      - Deadline countdown ditampilkan dengan flag warna (hijau→kuning→merah)
      - Legal RS approve/reject
      - Tanda tangan elektronik (PIC RS akselerasi ke Legal/Pimpinan RS)

   6) TANDA TANGAN & SELESAI:
      - Status target → "ditandatangani"
      - PKS lama tetap aktif, adendum menjadi lampiran resmi
      - completed_count di wpa_dropping_pusat bertambah
      - Saat completed_count = target_faskes_count → status dropping → "selesai"

   7) DEADLINE & ESKALASI:
      - Sistem cron (Vercel Cron Jobs) cek setiap hari jam 8 pagi:
        * H-7 deadline_draft → reminder "Dropping Pusat X: 7 hari lagi deadline draft" ke case_manager + kepala_bidang
        * H-3 → reminder kedua + eskalasi ke kepala_bidang
        * H-1 → reminder ketiga + flag merah di dashboard
        * H+0 (overdue) → status target "kedaluwarsa", notifikasi ke admin_kantor + kepala_bidang, dropping dianggap "perlu intervensi manual"
      - Reminder dicatat di wpa_dropping_pusat_reminder_log (hindari duplikat)

   8) DASHBOARD PROGRESS (untuk kepala bidang & admin):
      - Tabel: semua target faskes per dropping, sort by deadline
      - Filter: status (pending/drafting/review/signed/overdue)
      - Progress bar: X dari N faskes sudah tanda tangan
      - Export CSV untuk laporan ke kantor pusat
      - Klik faskes → detail timeline (audit log)

   9) KASUS KHUSUS:
      - Faskes yang PKS-nya sedang dalam proses adendum harga: target dropping tetap dibuat, tapi status "pending" sampai adendum harga selesai (lalu baru mulai drafting dropping)
      - Faskes yang PKS-nya akan berakhir < 30 hari: target dropping otomatis di-skip + flag "perlu perpanjangan dulu"
      - Faskes yang nonaktif: tidak ikut dropping
      - Kalau faskes menolak dropping: status "ditolak" + wajib isi alasan + notifikasi ke kepala_bidang untuk follow-up manual

F. PERPANJANGAN PKS (minim entry)
  - Sistem deteksi PKS ≤3 bulan sebelum berakhir → flag kuning, reminder otomatis
  - Case manager klik "Perpanjang" → sistem clone data PKS lama
  - Hanya field yang berubah yang perlu diisi (tanggal baru, BA negosiasi baru jika ada revisi tarif)
  - Generate draft PKS baru dengan parent_pks_id = PKS lama
  - Status PKS lama: "berakhir" setelah tanggal berakhir

G. PENGGINGAT & FLAG WARNA
  - Hijau: >3 bulan sebelum berakhir
  - Kuning: 3 bulan sebelum berakhir
  - Oranye: 1 bulan sebelum berakhir
  - Merah: 2 minggu sebelum berakhir / sudah lewat
  - Reminder otomatis: notifikasi in-app + email (kalau email di-setup)
  - Badge di sidebar untuk setiap role

H. BANK DATA TARIF & KOMPARASI KEWARJANAN
  - Tarif per faskes per kategori per tahun
  - Statistik: min, max, mean, median, P5, P95, std dev
  - Komparasi otomatis saat input tarif baru
  - Grafik boxplot per kategori (Chart.js / Recharts)
  - Filter: kategori, tahun, wilayah, jenis faskes
  - Export Excel untuk analisis offline

I. BOT RESEPSIONIS (widget pojok kanan)
  - Tombol floating di setiap halaman (kecuali login)
  - Saat dibuka: sapaan kontekstual ("Halo Case Manager, ada yang bisa saya bantu?")
  - Quick actions: "Buat PKS baru", "Cek PKS yang akan habis", "Lihat pengajuan faskes baru"
  - FAQ: jawaban berbasis konteks halaman yang sedang dibuka
  - Bisa pandu step-by-step (highlight elemen)
  - Backend: Groq API (llama-3.3-70b) dengan system prompt yang memahami aplikasi
  - Fallback rule-based kalau Groq 403 (seperti sekarang)
  - Memory: simpan percakapan di wpa_bot_messages (max 20 pesan terakhir)

J. EXPORT DOCX + PDF
  - DOCX: pakai library `docx` (npm) — generate sesuai template, replace {{PLACEHOLDER}} dengan data jsonb
  - PDF: puppeteer-core + @sparticuz/chromium (Vercel-compatible, serverless friendly)
  - Rute: /api/pks/[id]/export?format=docx|pdf
  - File disimpan ke bucket Supabase Storage `wpa-pks-docs` (sementara) + langsung download

K. AUTH & SECURITY (NextAuth Credentials Provider)
  - bcrypt 12 rounds (lebih kuat dari magang-cerdas yang 10)
  - JWT httpOnly + sameSite=lax + secure (prod)
  - Session 8 jam (configurable)
  - Rate limit login: 5 attempt per 15 menit per IP (pakai Upstash Redis atau in-memory Map untuk Vercel — atau Vercel KV)
  - Password strength: minimal 8 char, 1 huruf besar, 1 angka, 1 simbol
  - Self-register PIC RS & Legal RS: toggle di app_settings (default OFF)
  - 2FA opsional untuk admin_kantor & kepala_bidang (TOTP via otplib)
  - CSRF double-submit cookie
  - Security headers di middleware (copy dari magang-cerdas, sudah teruji)

L. MULTI-TENANT
  - Setiap tabel ada kantor_cabang_id (kecuali master yang shared: wpa_pks_template, wpa_tarif_kewajaran_rule, wpa_app_settings)
  - RLS policy di Supabase: user hanya bisa akses data kantor_cabang_id sendiri
  - Root admin_kantor bisa akses semua kantor cabang (cross-tenant)
  - Toggle on/off: di app_settings, kalau single-tenant mode, semua kantor_cabang_id = NULL atau ID default

=== KONFIRMASI AKHIR (3 keputusan terakhir) ===
1. Buatkan saya project Supabase baru (bukan pakai yang lama). Beri saya URL + anon key + service role key + DB password baru. (Karena saya tidak punya akses ke dashboard Supabase Anda.)
2. Bot resepsionis pakai Groq dengan token 403 — apakah Anda akan carikan token baru, atau saya buat fallback rule-based yang lebih canggih dulu? (Saya sarankan: buat fallback dulu, Groq bisa di-plug-in nanti via env var tanpa kode ulang.)
3. Email transactional untuk reminder: pakai Vercel Email (Resend) atau SMTP custom? Atau reminder in-app + WhatsApp only dulu?

---
Task ID: DEPLOY-001
Agent: main
Task: Build, deploy & verify WPA application end-to-end

Work Log:
- Setup Next.js 16 project (already initialized by skill fullstack-dev)
- Install deps: @supabase/supabase-js, @supabase/ssr, bcryptjs, jsonwebtoken, docx, mammoth
- Apply 26 tabel WPA ke Supabase project baru (hfhvsiuebrwrqmqzsroc) via pooler IPv4
- Setup env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXTAUTH_SECRET, GEMINI_API_KEY
- Build core: lib/supabase.ts, lib/auth.ts (JWT+bcrypt), lib/auth-constants.ts, lib/wpa-utils.ts, middleware.ts (security headers)
- Build 5 role layouts (admin_kantor, case_manager, kepala_bidang, pic_rs, legal_rs) dengan tema warna berbeda
- Build 5 dashboard per role dengan empati peran (prioritas kerja berbeda)
- Build RoleShell.tsx dengan sidebar responsif + notification badge + bot widget
- Build BotReceptionist.tsx (Gemini API + fallback rule-based)
- Build UserManagement.tsx (CRUD user, reset password, toggle active)
- Build 26 placeholder pages untuk sub-routes
- Build API routes: /api/auth/login, /api/auth/logout, /api/setup, /api/health, /api/users/create, /api/users/update, /api/bot/chat
- Fix: split auth constants ke file terpisah (avoid next/headers di client components)
- Fix: zod schema sanitize empty string UUID
- Fix: wrap useSearchParams in Suspense (Next.js build requirement)
- Setup GitHub repo baru `wpa-pks-bpjskaker` (NOT touching magang-cerdas-pwa, mushola-nur-hidayah, Quran-Saku, kerjaaman)
- Push code (clean history, no secrets committed)
- Setup Vercel project baru `wpa-pks-bpjskaker` (NOT touching existing Vercel projects)
- Add 7 env vars to Vercel (Supabase, NextAuth, Gemini)
- Trigger production deployment → READY in ~100s
- Verify via Agent Browser: login OK, dashboard OK, bot OK on production

Stage Summary:
- ✅ Production URL: https://wpa-pks-bpjskaker.vercel.app
- ✅ GitHub repo: https://github.com/agungkesmas/wpa-pks-bpjskaker
- ✅ Supabase project: hfhvsiuebrwrqmqzsroc (isolated, 26 tabel wpa_)
- ✅ Default admin: admin@wpa.local / password dari env DEFAULT_ADMIN_PWD
- ✅ Login + role redirect works
- ✅ Bot resepsionis widget aktif (Gemini quota exhausted → fallback rule-based works perfectly)
- ✅ Audit log records all auth activities
- ✅ TIDAK ADA proyek aktif yang diganggu (magang-cerdas-pwa, mushola-nur-hidayah, dll tetap utuh)
- Screenshots saved: /home/z/my-project/download/wpa_login_page.png, wpa_admin_dashboard.png
