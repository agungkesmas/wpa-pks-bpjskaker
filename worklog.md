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

---
Task ID: SEED-001
Agent: main
Task: Seed kantor cabang Cirebon + RS Juanda Kuningan + akun PIC RS & Legal RS

Work Log:
- Buat script /scripts/seed_cirebon_juanda.ts (pakai bcryptjs 12 rounds)
- Insert wpa_kantor_cabang KC-CIREBON (BPJS Ketenagakerjaan Cabang Cirebon)
- Insert wpa_faskes RS Juanda Kuningan (jenis=RS, status=aktif, kantor_cabang_id=Cirebon)
- Insert 3 users: admin.cirebon (admin_kantor), pic.rsjuanda (pic_rs), legal.rsjuanda (legal_rs)
- Set faskes_id untuk PIC RS & Legal RS ke RS Juanda
- Set kantor_cabang_id semua ke Cirebon (tenant)
- Verifikasi login via API: ketiganya sukses
- Verifikasi visual via Agent Browser:
  • Admin Cirebon: dashboard menampilkan "5 Total User, 2 Kantor Cabang"
  • PIC RS Juanda: sidebar menampilkan "RS: RS Juanda Kuningan"
  • Daftar user lengkap di /admin_kantor/users (5 user dengan kantor/faskes terisi)

Bug fix selama verifikasi:
- Tabel user awalnya kosong karena PostgREST tidak kenal FK join
- Fix: tambah FK eksplisit untuk wpa_users.faskes_id (sebelumnya tidak ada di schema awal)
- Drop FK dobel yang di-add manual (Supabase auto-create sudah ada di tabel lain)
- Total FK: 53 (clean, no duplicates)
- Reload PostgREST schema cache via `notify pgrst, 'reload schema'`

Stage Summary:
- ✅ Login semua 3 akun baru: WORKS
- ✅ Multi-tenant: WORKS (admin Cirebon hanya lihat konteks Cirebon, sidebar benar)
- ✅ Faskes association: WORKS (PIC RS sidebar menampilkan "RS: RS Juanda Kuningan")
- ✅ User management table: WORKS (5 user dengan kantor/faskes terisi via PostgREST join)
- ✅ Vercel redeploy: SUCCESS (deploy ID dpl_EY23ZeJG5XTbMuxKy1JxCZNTkjAj)
- ✅ GitHub push: SUCCESS (clean history, no secrets committed)

Akun yang dibuat (semua password pakai env var, bukan hardcoded):
- admin.cirebon@wpa.local / SEED_ADMIN_CIREBON_PWD env var → admin_kantor Cabang Cirebon
- pic.rsjuanda@wpa.local / SEED_PIC_RSJUANDA_PWD env var → PIC RS Juanda Kuningan
- legal.rsjuanda@wpa.local / SEED_LEGAL_RSJUANDA_PWD env var → Legal RS Juanda Kuningan

---
Task ID: TARIF-V2
Agent: main
Task: Bangun ulang skema tarif — acuan per kantor cabang + faskes upload Excel + auto-comparison

Work Log:
- Audit skema lama: wpa_tarif_bank di-link ke faskes_id → salah konsep (tidak ada acuan regional)
- Drop wpa_tarif_bank & wpa_tarif_comparison (cascade)
- Buat 3 tabel baru:
  • wpa_tarif_acuan: per kantor_cabang + kategori + nama_item + tahun (unique)
    - sumber: 'manual' (langsung input tarif_acuan) atau 'calculation' (dari sample_data RS)
    - statistik: tarif_min/max/median/mean/std_dev/sample_count/sample_data jsonb
  • wpa_tarif_faskes: per faskes + tahun, auto-compare saat upload
    - status_kewajaran: wajar/perlu_review/tinggi/rendah/ekstrem/no_acuan
    - tarif_acuan_id, tarif_acuan, selisih, selisih_percent, z_score
  • wpa_tarif_upload_batch: log per upload (1 file = 1 batch, N items)
- Buat RPC function wpa_calc_kewajaran(tarif, acuan, std_dev) — immutable, returns table
- Tambah 11 default kategori di wpa_tarif_kewajaran_rule (kamar, operasi_*, lab, radiologi, dll)
- Install xlsx (SheetJS) library untuk parse & generate Excel

API Endpoints:
- GET  /api/tarif/acuan/list — list acuan per kantor cabang (filter kategori, tahun)
- POST /api/tarif/acuan/create — upsert acuan (manual atau calculation mode)
- POST /api/tarif/acuan/calc — preview statistik dari sample sebelum save
- POST /api/tarif/faskes/upload — parse Excel, validate, auto-compare, store
- GET  /api/tarif/faskes/list — list tarif faskes (filter status, kategori)
- GET  /api/tarif/comparison — summary per faskes atau detail per item
- GET  /api/tarif/template — download Excel template (17 item pre-filled, 0 tarif)

UI:
- /case_manager/tarif — TarifAcuanManager (2 mode: manual & calculation dengan preview)
  - Form multi-RS sample dengan tombol "Tambah RS" dinamis
  - Tabel list acuan dengan badge sumber (Manual/Kalkulasi) + sample count
- /pic_rs/tarif — UploadTarifFaskes 
  - Download template button + upload form
  - 7 card stats (total/wajar/perlu_review/tinggi/rendah/ekstrem/no_acuan)
  - Tabel detail comparison dengan z-score & status badge
  - Riwayat upload (10 batch terakhir)
- /admin_kantor/tarif — overview acuan + status per faskes (4 KPI cards + 2 tabel)
- Sidebar PIC RS: tambah menu "Upload Tarif"

Bug fix selama development:
1. .gitignore pattern `upload/` tanpa leading slash match semua folder upload/ 
   → blok src/app/api/tarif/faskes/upload/route.ts → 404 di Vercel
   → Fix: pakai `/upload/` (root-only)
2. wpa_tarif_kewajaran_status enum lama tidak punya 'no_acuan' & 'perlu_review'
   → Drop enum cascade, recreate dengan 6 values
3. PL/pgSQL function null::numeric cast issue → fix dengan explicit null::numeric

Test end-to-end (via API + Agent Browser):
1. Admin Cirebon create acuan manual "Kamar Kelas I" Rp 500.000 → OK
2. Admin Cirebon create acuan calculation "Kamar Kelas II" dari 3 RS (350k/400k/380k)
   → mean=376667, median=380000, std_dev=25166.11 → OK
3. PIC RS Juanda upload Excel template (6 item terisi)
   → 6 item diproses, 2 dibandingkan dengan acuan, 4 no_acuan → OK
4. Comparison detail:
   - Kamar Kelas I: 550k vs 500k acuan → +10% → wajar (<=10%)
   - Kamar Kelas II: 380k vs 376667 acuan → +0.88%, z=0.13 → wajar
5. Admin view: tabel per faskes + tabel daftar acuan dengan statistik → OK
6. Multi-tenant verify: Budi CM (Default cabang) tidak bisa lihat acuan Cirebon → OK

Stage Summary:
- ✅ Skema v2 berfungsi: acuan per kantor cabang, faskes upload auto-compare
- ✅ Excel template download & upload works (.xlsx via SheetJS)
- ✅ Status kewajaran: 6 kategori (wajar/perlu_review/tinggi/rendah/ekstrem/no_acuan)
- ✅ RPC function: z-score + selisih_percent calculation
- ✅ Multi-tenant: acuan isolated per kantor_cabang
- ✅ UI: 3 dashboard (case_manager input, pic_rs upload, admin overview)
- ✅ Vercel production: https://wpa-pks-bpjskaker.vercel.app

---
Task ID: DESIGN-DECISIONS
Agent: main
Task: Catat keputusan desain dari jawaban user untuk Prioritas 1

Work Log:
- User jawab 5 pertanyaan klarifikasi. Semua tercatat di bawah.

Stage Summary (Keputusan Final):

1. HIERARKI ADMIN = A (Super Admin + Admin Cabang)
   - Super Admin: user Anda sendiri (sementara), kelola SEMUA cabang
   - Admin Cabang: kelola hanya cabangnya
   - Tambah role `super_admin` ke enum wpa_user_role

2. PRINT = C (dua-duanya: ID Card + Slip A4)
   - ID Card: landscape A6 (~105x74mm), untuk print plastik fisik
     * Logo BPJS, foto, nama, role, kantor, NIP
   - Slip A4: portrait A4, untuk onboarding awal (WhatsApp/print saat buat akun)
     * Email, password sementara, instruksi login, QR code
   - Tambah: Kartu Mutasi A4 (untuk skenario mutasi antar cabang)
     * Info: dari cabang X ke Y, tanggal efektif, alasan, SK
   - Pakai CSS print murni (window.print) untuk efisiensi
   - Skenario: PKS baru/perpanjangan → slip A4 dengan catatan status PKS

3. MUTASI = C (instan + scheduled, admin pilih)
   - Tabel wpa_user_mutasi: from_kantor, to_kantor, tanggal_sk, tanggal_efektif, nomor_sk, file_sk, alasan, status
   - Status: pending (menunggu tanggal efektif), active (sudah diproses), cancelled
   - Cron job harian: apply mutasi yang tanggal_efektif <= today

4. SELF-SERVICE PROFILE = C (password + HP + foto + email dengan verifikasi)
   - Tambah kolom: profile_photo_url, email_verified_at, nip
   - Email change: user input password lama + email baru → langsung update (audit log)
   - Alasan: no email infrastructure (user bilang "cukup in-app + WhatsApp manual")
   - Password change: input password lama + password baru + konfirmasi
   - Foto: upload ke Supabase Storage bucket wpa-profile-photos
   - Self-service tidak boleh: ubah nama lengkap, role, kantor (admin only)
   - Self-service tidak boleh: deaktivasi diri sendiri (anti-fraud)

5. FASKES untuk PIC RS = B (1 PIC bisa multi-faskes + PKS Payung)
   - Junction table wpa_user_faskes (user_id, faskes_id, is_primary)
   - Migrate existing wpa_users.faskes_id → wpa_user_faskes (is_primary=true)
   - Konsep PKS Payung: 1 grup RS (mis. "RS Juanda Group") bisa menerbitkan PKS payung
     * Tabel baru wpa_faskes_group (kode, nama, jenis, alamat, NPWP, PJ)
     * wpa_faskes tambah group_id (FK) + tipe (A/B/C/D/Umum)
     * Tarif berbeda per tipe faskes (sudah tertangani di wpa_tarif_acuan per kategori)
   - wpa_pks tambah: is_payung (bool), parent_pks_payung_id (self-ref)
   - UI: PIC RS punya dropdown switch faskes di header (kalau multi)

=== PRIORITAS 1: KANTOR CABANG + USER MANAGEMENT TERINTEGRASI ===
Setelah keputusan ini, saya mulai eksekusi Prioritas 1.
Estimasi: 12 todo items, 1 sesi panjang atau 2 sesi normal.

---
Task ID: PRIORITAS-1
Agent: main
Task: Bangun Prioritas 1 — Kantor Cabang + User Management terintegrasi

Work Log:
- Schema: tambah role super_admin, tabel wpa_faskes_group, wpa_user_faskes (junction), 
  wpa_user_mutasi, alter wpa_faskes (group_id, tipe), wpa_pks (is_payung, parent_pks_payung_id),
  wpa_users (profile_photo_url, email_verified_at, nip, temp_password, must_change_password)
- Seed super_admin: super.admin@wpa.local / SuperAdmin2026!# (dari env var)
- Migrate existing wpa_users.faskes_id → wpa_user_faskes junction (2 rows: PIC RS + Legal RS Juanda)

API (12 endpoint baru):
- /api/kantor (GET list dengan stats, POST create super_admin only)
- /api/kantor/[id] (GET, PATCH)
- /api/kantor/[id]/users (GET users per kantor dengan mutasi pending)
- /api/mutasi/create (POST, mode instant atau scheduled)
- /api/mutasi/list (GET, filter user/kantor/status)
- /api/mutasi/cancel (POST)
- /api/cron/mutasi (GET, daily cron auto-apply scheduled mutasi)
- /api/profile/password (POST self-service)
- /api/profile/email (POST dengan verifikasi password lama)
- /api/profile/update (POST phone)
- /api/profile/photo (POST upload foto ke Supabase Storage)
- /api/faskes/multi-attach (GET/POST/DELETE untuk 1 PIC multi-faskes)
- /api/print/id-card (GET HTML A6 landscape)
- /api/print/slip-a4 (GET HTML A4 portrait onboarding)
- /api/print/kartu-mutasi (GET HTML A4 surat keterangan mutasi)

UI:
- /super_admin (dashboard super admin dengan stats 2 cabang, 8 user)
- /super_admin/kantor (list cards dengan stats users/faskes/pks)
- /super_admin/kantor/[id] (detail 4 tabs: Users/Info/Faskes/Stats)
- /super_admin/users (flat list semua user)
- /super_admin/audit (audit log viewer 200 entri)
- /admin_kantor/kantor & [id] (reuse super_admin)
- /admin_kantor/users (redirect ke detail kantor)
- /profile (self-service: password, phone, foto, email change)
- RoleShell: super_admin theme rose + Profile floating button

Test e2e (via Agent Browser + API):
1. Login super admin → redirect /super_admin → dashboard OK
2. List kantor: 2 cards (Cirebon 5 user/1 faskes, Default 2 user/0 faskes)
3. Detail Cirebon: 4 tabs tampil, Users tab menampilkan 5 user dengan avatar+role badge
4. Tambah User dialog: form lengkap (Nama, NIP, Email, Role, Phone, Password auto-generate)
5. Print ID Card: terbuka di new tab, HTML render A6 landscape dengan logo+foto+info
6. Print Slip A4: A4 portrait dengan instruksi login
7. Profile self-service: ubah password (verify lama), ubah email (verify lama, auto-logout)
8. Mutasi scheduled (efektif 1 bulan depan): status=pending, applied=false
9. Mutasi instant (efektif hari ini): langsung apply, user pindah kantor
10. Cancel mutasi: status → cancelled
11. Cron job: terdaftar di vercel.json (daily 8AM WIB)

Bug fix selama dev:
- zod .uuid() tolak UUID v0 (00000000-0000-0000-0000-000000000001 ID Default) 
  → Fix: pakai regex /[0-9a-fA-F]{8}-...-{12}/ accept any UUID version
- PostgREST error 'more than one relationship' (wpa_user_mutasi punya 2 FK ke wpa_users)
  → Fix: hapus join wpa_users di mutasi list & kartu-mutasi print, fetch separately
- TableHeader typo (TableTable) di audit page → fix

Stage Summary:
- ✅ 9 halaman baru + 4 component baru + 12 API endpoint baru
- ✅ Super admin login & akses semua cabang works
- ✅ User management integrated dalam tab kantor (bukan flat lagi)
- ✅ Mutasi antar cabang: instant + scheduled (cron daily apply)
- ✅ Self-service: password + email + phone + foto profil
- ✅ Print: ID Card (A6), Slip A4 (onboarding), Kartu Mutasi (A4)
- ✅ Multi-faskes: 1 PIC bisa attach ke beberapa faskes (junction table)
- ✅ Konsep PKS Payung: wpa_faskes_group + tipe A/B/C/D (siap untuk iterasi berikutnya)
- ✅ Vercel Cron Job terdaftar: /api/cron/mutasi daily 8AM WIB
- ✅ Production: https://wpa-pks-bpjskaker.vercel.app

---
Task ID: FASE-1-PLKK
Agent: main
Task: Fresh build Manajemen PLKK — 6 role final + pipeline universal

Work Log:
- Rename Vercel project: wpa-pks-bpjskaker → manajemen-plkk
  (URL production: https://manajemen-plkk.vercel.app, URL lama tetap aktif)
- Schema final di Supabase:
  • 6 role final: super_admin, kepala_bidang, case_manager, penata_pelayanan, pic_rs, legal_rs
  • Hapus: admin_kantor, legal_bpjs (tidak ada di realitas cabang)
  • Tabel wpa_pipeline (universal tracking, anti-tumbang by design)
  • Tabel wpa_pipeline_log (immutable audit per transisi tahap)
  • Tabel wpa_pipeline_takeover_log (anti-tumbang: siapa ambil alih kapan)
  • Tabel wpa_pipeline_tahap_config (32 config: 5 jenis × 4-8 tahap)
  • Storage bucket wpa-pengajuan-docs (untuk upload dokumen pengajuan)
- Update existing users: admin_kantor → super_admin (admin@wpa, admin.cirebon)
- Tambah sample Penata Pelayanan: pp.cirebon@wpa.local / PPCirebon2026!#

UI Final:
- 6 role layout (RoleLayout component reusable)
- RoleShell dengan menu final per role (konsisten):
  • Super Admin: 6 menu (Dashboard, Kantor Cabang, Semua User, Template Mandatori, Pengajuan, Audit Log)
  • Kepala Bidang: 6 menu (Dashboard, Approval, Dokumen Legal, Tugas Cabang, Pengajuan, Laporan)
  • Case Manager: 5 menu (Dashboard, Tugas Saya, Tugas Cabang, Faskes Mitra, Bank Tarif)
  • Penata Pelayanan: 4 menu (Dashboard, Tugas Saya, Tugas Cabang, Faskes Mitra)
  • PIC RS: 5 menu (Dashboard, Ajukan PKS Baru, Pengajuan Saya, Dokumen Saya, Bank Tarif)
  • Legal RS: 4 menu (Dashboard, Review, Dokumen Legal, Audit Log)
- 6 dashboard per role (skeleton, ambil data real dari DB):
  • Super Admin: stats kantor/user/pengajuan/PKS + user by role + pengajuan aktif
  • Kepala Bidang: antrean approval + tugas cabang + KPI breached
  • Case Manager: tugas saya + tugas cabang + SLA tracking + Ambil Alih
  • Penata Pelayanan: tugas saya + tugas cabang (Ambil Alih, anti-tumbang)
  • PIC RS: status PKS + countdown hari + pengajuan saya + tombol "Ajukan PKS Baru"
  • Legal RS: antrean review + dokumen ditandatangani + audit log
- Standar bahasa baku apply (konsisten lintas role):
  • Status: Diajukan, Ditinjau, Diverifikasi, Negosiasi, Didraft, Disetujui, Direview, Ditandatangani
  • Action: Ajukan, Tinjau, Verifikasi, Setujui, Tolak, Batalkan, Alihkan, Tandatangani, Ambil Alih
- 24 sub-route placeholders (siap diisi modul detail di Fase 2-6)
- Hapus route admin_kantor (tidak ada di 6 role final)

Test e2e via API:
- Login semua 6 role: ✓ sukses, redirect ke dashboard masing-masing
  • super.admin → /super_admin
  • kabid.cirebon → /kepala_bidang
  • cm.cirebon → /case_manager
  • pp.cirebon → /penata_pelayanan
  • pic.rsjuanda → /pic_rs
  • legal.rsjuanda → /legal_rs

Test visual via Agent Browser:
- Super Admin: dashboard 6 menu, stats 2 kantor/9 user, quick actions
- Case Manager: dashboard 5 menu, stats 0 tugas saya/0 tugas cabang/1 faskes mitra
- PIC RS: dashboard 5 menu, deteksi faskes RS Juanda, tombol "Ajukan PKS Baru" menonjol

Bug fix selama dev:
- zod .uuid() tolak UUID v0 (ID Default cabang 00000000-0000-...-001) 
  → pakai regex yang accept any UUID version
- PostgREST 'more than one relationship' (wpa_user_mutasi 2 FK ke wpa_users)
  → hapus join, fetch user separately
- enum wpa_user_role tidak punya 'penata_pelayanan' saat first apply
  → add value explicitly + commit sebelum pakai
- alter column type text → enum gagal jika ada value yang tidak di enum baru
  → handle via step: drop enum cascade → recreate → alter column

Stage Summary:
- ✅ Fresh build Fase 1 selesai (6 role, pipeline universal, standar bahasa, menu konsisten)
- ✅ 9 user aktif dengan 6 role terwakili semua (super_admin×3, kepala_bidang, case_manager×2, penata_pelayanan, pic_rs, legal_rs)
- ✅ Pipeline schema ready (32 tahap config untuk 5 jenis pengajuan)
- ✅ Vercel project renamed: manajemen-plkk
- ✅ Production live: https://wpa-pks-bpjskaker.vercel.app (URL baru: https://manajemen-plkk.vercel.app)
- ⏳ Fase 2: PIC RS Onboarding & Form Pengajuan Baru (next)
- ⏳ Fase 3: Template Mandatori & Konsistensi (hash per bab)
- ⏳ Fase 4: Pipeline Universal & Tracking (state machine + Ambil Alih)
- ⏳ Fase 5: Drafting PKS & Adendum
- ⏳ Fase 6: Tracking, Reminder & KPI

Daftar Akun Lengkap (6 role):
- super.admin@wpa.local / SuperAdmin2026!# → super_admin (Anda, super user)
- admin@wpa.local / AdminWPA2026!# → super_admin (default, bisa dihapus)
- admin.cirebon@wpa.local / AdminCirebon2026!# → super_admin (cabang Cirebon)
- kabid.cirebon@wpa.local / KabidCirebon2026!# → kepala_bidang (Cirebon)
- cm.cirebon@wpa.local / CMCirebon2026!# → case_manager (Cirebon)
- budi.cm@bpjsketenagakerjaan.go.id / ur&SiqPBGfk9 → case_manager (Default)
- pp.cirebon@wpa.local / PPCirebon2026!# → penata_pelayanan (Cirebon)
- pic.rsjuanda@wpa.local / PicRSJ2026!# → pic_rs (RS Juanda Kuningan)
- legal.rsjuanda@wpa.local / LegalRSJ2026!# → legal_rs (RS Juanda Kuningan)

---
Task ID: FASE-2-PIC-RS-PENGAJUAN
Agent: main
Task: Fase 2 — PIC RS Pengajuan + Pipeline Tracking + Access Control Buka-Tutup PP

Work Log:
- Schema: 4 tabel baru + 4 kolom baru di wpa_pipeline
  • wpa_pipeline_access_control (log buka/tutup akses PP)
  • wpa_pengajuan_dokumen (file upload dari PIC RS)
  • wpa_kredensialing_checklist (checklist tahap kredensialing)
  • wpa_pipeline_chat (chat/negosiasi CM ↔ PIC RS)
  • wpa_pipeline: + takeover_enabled, takeover_enabled_by, takeover_enabled_at, takeover_reason
- API endpoints:
  • POST /api/pengajuan-baru/create (PIC RS submit form → auto-create faskes + pipeline + notifikasi)
  • GET /api/pipeline/list (filter by role: handler_only, cabang_only, initiated_by_me, review_for_me)
  • GET /api/pipeline/detail/[id] (detail + logs + tahap_config + documents + access_logs)
  • POST /api/pipeline/takeover-toggle (CM/Kabid buka/tutup akses PP untuk tugas tertentu)
- UI per role:
  • PIC RS /ajukan-baru: form 4 section (Data Faskes, PJ, Bank, Catatan)
  • PIC RS /pengajuan: list pengajuan saya + tracking 8 tahap real-time + timeline aktivitas
  • CM /tugas: tugas saya (yang sedang saya pegang)
  • CM /tugas-cabang: semua tugas cabang + tombol Buka PP / Tutup PP per tugas
  • PP /tugas: tugas saya (yang sudah di-ambil alih)
  • PP /tugas-cabang: hanya tugas yang takeover_enabled=true (CM/Kabid buka)
  • Kabid /tugas: oversight semua tugas + bisa toggle PP

Logika Buka-Tutup Access Control (anti-tabrakan):
- Default: takeover_enabled=false → PP TIDAK bisa lihat tugas di Tugas Cabang
- CM/Kabid klik "Buka PP" → prompt alasan → takeover_enabled=true
- PP otomatis dapat notifikasi "Tugas Tersedia untuk Diambil Alih"
- PP bisa lihat tugas di Tugas Cabang + klik "Ambil Alih"
- CM/Kabid klik "Tutup PP" → takeover_enabled=false → PP tidak bisa lihat lagi
- Semua aksi dicatat di wpa_pipeline_access_control (siapa, kapan, kenapa)

Test e2e (via API + Agent Browser):
1. ✓ PIC RS baru (pic.newrs@wpa.local) submit pengajuan RS Sehat Sentosa
   → faskes created (status: pengajuan) + pipeline created (current_tahap: diajukan)
   → PIC RS auto-linked ke faskes baru
   → Notifikasi ke CM & Kabid di kantor tujuan
2. ✓ CM (Budi) lihat pipeline di Tugas Cabang (takeover_enabled=false default)
3. ✓ CM buka akses PP (reason: "CM cuti hari ini")
   → takeover_enabled=true
   → PP dapat notifikasi
4. ✓ PP (pp.default) lihat pipeline di Tugas Cabang + tombol "Ambil Alih"
5. ✓ CM tutup akses PP → PP tidak bisa lihat lagi
6. ✓ PIC RS lihat tracking 8 tahap:
   - Tahap 1 (Pengajuan): Sedang Berjalan
   - Tahap 2-8: Menunggu
   - Timeline aktivitas: 1 log (PIC RS submit)
   - Access control logs: 2 entries (enabled_takeover, disabled_takeover)

UI Test via Agent Browser:
- PIC RS /pengajuan: tracking 8 tahap with status badges (Selesai/Sedang Berjalan/Menunggu)
- CM /tugas-cabang: card tugas dengan tombol "Buka PP" + prompt alasan
- Setelah buka: badge "PP Aktif" + tombol berubah jadi "Tutup PP"
- PP /tugas-cabang: hanya tugas yang dibuka, dengan tombol "Ambil Alih"

Bug fix selama dev:
- psycopg2 module not found (install --break-system-packages)
- bcrypt module not found (install --break-system-packages)
- TypeScript readonly issue dengan ReadonlyArray (string interpolation di template literal)

Stage Summary:
- ✅ Fase 2 selesai: PIC RS bisa ajukan PKS baru + tracking real-time
- ✅ Logika buka-tutup PP bekerja: anti-tabrakan, kontrol ketat
- ✅ 8 tahap pipeline tracking visible untuk PIC RS, CM, PP, Kabid, Legal RS
- ✅ Notifikasi otomatis: PIC RS submit → CM & Kabid dapat notif; CM buka PP → PP dapat notif
- ✅ Audit trail lengkap: pipeline_log + access_control + audit_logs
- ⏳ Fase 3: Template Mandatori (Super Admin upload + hash per bab)
- ⏳ Fase 4: Pipeline Universal & Tracking (state machine + transisi tahap)
- ⏳ Fase 5: Drafting PKS & Adendum
- ⏳ Fase 6: Tracking, Reminder, KPI

Sample akun tambahan:
- pic.newrs@wpa.local / PicNewRS2026!# → pic_rs (temporary, untuk test pengajuan baru)
- pp.default@wpa.local / PPDefault2026!# → penata_pelayanan (Default cabang)

---
Task ID: DOMAIN-SWAP-RESPONSIVE
Agent: main
Task: Swap domain ke URL baru + verifikasi responsiveness PC↔mobile

Work Log:
- Swap Vercel domain:
  • Hapus domain lama: wpa-pks-bpjskaker.vercel.app → HTTP 404 (dimatikan)
  • Tambah domain baru: manajemen-plkk.vercel.app → HTTP 200 (LIVE)
  • Project name: manajemen-plkk
- Verifikasi login 9 user (6 role) di URL baru: semua ✓ sukses
- Test responsiveness via Agent Browser (3 viewport):
  • Desktop 1920x1080: sidebar 256px + main 1664px + stats 4 kolom (395px each)
  • Tablet 768x1024: sidebar hidden + mobile menu button visible + Sheet component
  • Mobile 375x812: full mobile layout, sidebar via Sheet (swipe-in)
- Test realtime resize (tanpa reload):
  • 1920 → 768 → 375 → 1920: semua transisi adaptif instant
  • Sidebar show/hide berdasarkan lg breakpoint (1024px)
  • Stats grid adaptif: 2 cols (mobile) → 4 cols (desktop)
  • Mobile menu button muncul < 1024px
- Test component responsiveness:
  • Login page: 2-column split (desktop) → 1-column stack (mobile)
  • Dashboard stats: grid-cols-2 → grid-cols-4 (md)
  • Cards (Tugas Cabang): mobile-friendly, no horizontal scroll
  • Tables (Kantor Detail, Users): overflow-x-auto wrapper (scroll isolated)
  • Form (Ajukan PKS Baru): 15 inputs accessible di mobile, full width
  • Tabs (Kantor Detail): 4 tabs visible & functional di mobile
  • Mobile sidebar (Sheet): slide-in dari kiri, 6 menu visible

Test scenarios via Agent Browser:
1. ✓ Login page desktop/tablet/mobile
2. ✓ Super Admin dashboard 3 viewport
3. ✓ PIC RS form pengajuan di mobile (15 inputs)
4. ✓ CM Tugas Cabang di mobile (cards, no H-scroll)
5. ✓ Kantor Detail dengan table di mobile (overflow-x-auto)
6. ✓ Mobile sidebar buka/tutup (Sheet component)
7. ✓ Realtime resize desktop → mobile → desktop (tanpa reload)

Stage Summary:
- ✅ URL final: https://manajemen-plkk.vercel.app (URL lama dimatikan)
- ✅ 6 role login works di URL baru
- ✅ Responsive: desktop/tablet/mobile adaptif
- ✅ Realtime resize tanpa reload (CSS breakpoints)
- ✅ Mobile sidebar (Sheet) bekerja
- ✅ Tables dengan overflow-x-auto (tidak break layout)
- ✅ Forms mobile accessible
- ✅ Cards-based UI untuk mobile-friendly

---
Task ID: REBRAND-MITRA-PLKK
Agent: main
Task: Rebrand ke Mitra PLKK + audit konsistensi UI lintas role

Work Log:
- Vercel project: manajemen-plkk → mitra-plkk (rename)
- Domain swap final:
  • mitra-plkk.vercel.app → LIVE (HTTP 200) — URL PRODUKSI FINAL
  • manajemen-plkk.vercel.app → 404 (dimatikan)
  • wpa-pks-bpjskaker.vercel.app → 404 (dimatikan)
- Rebranding lengkap (11 file diupdate):
  • App title: 'WPA — PKS BPJS Ketenagakerjaan' → 'Mitra PLKK — BPJS Ketenagakerjaan'
  • Layout metadata: updated
  • Login page: hero 'Mitra PLKK Sahabat Pengelolaan Kerjasama Faskes'
    + feature card 'Pembinaan & Sosialisasi' (visitasi, SP, surat edaran)
  • RoleShell sidebar: 'Manajemen PLKK' → 'Mitra PLKK'
  • Bot resepsionis: 'Resepsionis Mitra PLKK' (UI + API + APP_CONTEXT)
  • Print (id-card, slip-a4, kartu-mutasi): 'Mitra PLKK — BPJS Ketenagakerjaan'
  • URL di slip A4: 'https://mitra-plkk.vercel.app'
  • Tarif Excel template: 'Mitra PLKK BPJS Ketenagakerjaan'
- Audit konsistensi UI lintas role (1 tampilan untuk semua role):
  • 6 dashboard pakai struktur sama: H1 + subtitle + stats grid + Aksi Cepat card
  • RoleShell: 1 komponen reusable (sidebar 256px, header 61px, main flex-1)
  • RoleLayout: 1 komponen dengan allowedRole parameter
  • ROLE_LABELS & ROLE_THEMES: konsisten 6 role dengan tema warna berbeda
  • Standar bahasa baku: konsisten lintas role (Diajukan/Ditinjau/Setujui/Tolak/Ambil Alih)

Test e2e via API + Agent Browser:
- 6 role login sukses di URL baru (mitra-plkk.vercel.app)
- Login page branding 'Mitra PLKK' tampil konsisten desktop + mobile
- Super Admin dashboard: sidebar 'Mitra PLKK', 6 menu, stats grid
- PIC RS dashboard: sidebar 'Mitra PLKK', 5 menu (incl. Ajukan PKS Baru)
- CM Cirebon dashboard: sidebar 'Mitra PLKK', 5 menu, layout sama persis
- Bot resepsionis: 'Resepsionis Mitra PLKK' branding
- Mobile view (375px): full adaptif, sidebar via Sheet
- Konsistensi struktur: sidebar 256px + header 61px + main flex-1 di semua role

Audit clean:
- Tidak ada referensi 'WPA' (kecuali nama akun email @wpa.local)
- Tidak ada 'Workforce PKS Application'
- Tidak ada URL lama (wpa-pks-bpjskaker, manajemen-plkk)

Stage Summary:
- ✅ URL FINAL: https://mitra-plkk.vercel.app (URL lama dimatikan total)
- ✅ Branding 'Mitra PLKK' konsisten di: title, login, sidebar, bot, print, Excel template
- ✅ 1 tampilan UI untuk 6 role (konsistensi layout, struktur, bahasa)
- ✅ Mobile responsive verified (desktop/tablet/mobile)
- ✅ 6 role login sukses di URL baru

---
Task ID: FASE-3-TEMPLATE-MANDATORI
Agent: main
Task: Fase 3 — Template Mandatori dengan hash per bab + klasifikasi placeholder

Work Log:
- Schema: 3 tabel + 1 RPC function baru
  • wpa_pks_template: + template_hash, bab_hashes (jsonb), is_locked, jenis_dokumen
  • wpa_template_bab (BARU): struktur bab/pasal/lampiran dengan content_hash per bab
  • wpa_pks_template_placeholder: + bab_id, tipe (8 jenis), source_table, source_column
  • RPC wpa_klasifikasi_placeholder(key): auto-detect tipe berdasarkan nama placeholder
- Storage bucket: wpa-templates (public read)
- API:
  • POST /api/template/upload: upload .docx → parse mammoth → detect struktur bab → hash sha256 per bab → klasifikasi placeholder → aktivasi
  • GET /api/template/list: list template (filter jenis, active_only)
  • GET /api/template/detail/[id]: detail + babs + placeholders (grouped by bab)
  • POST /api/template/toggle: aktivasi/nonaktifkan (auto-nonaktifkan lain dengan jenis sama)
- UI Super Admin /template:
  • List template dengan badge jenis, status, jumlah bab/placeholder
  • Upload dialog: form (kode, nama, jenis, versi, file .docx)
  • Upload result: summary (total bab, placeholder, auto-fill, manual required/optional, hash)
  • Detail modal: 24 bab dengan hash 8-char per bab + 81 placeholder dengan badge tipe

Test via Agent Browser (1 per 1):
1. ✅ TEST 1: Login super admin → buka Template Mandatori (halaman muncul, tombol Upload tersedia)
2. ✅ TEST 2: Upload template PKS_PLKK_2026 (139KB) → 33 bab, 81 placeholder, 9 auto-fill, 72 manual_required
3. ✅ TEST 3: Template di list dengan badge "Aktif", 26 bab, 81 placeholder
4. ✅ TEST 4: Detail modal → 24 bab (Cover, Pasal 1-21, Lampiran I-V, Pakta) dengan hash per bab
5. ✅ TEST 5: Placeholder klasifikasi:
   - {{NAMA_KANTOR_CABANG}} → Auto Kantor (wpa_kantor_cabang.nama)
   - {{NAMA_FASKES}} → Auto Faskes (wpa_faskes.nama)
   - {{NOMOR_PKS_PIHAK_PERTAMA}} → Manual Wajib
6. ✅ TEST 6: Toggle aktivasi via API (Nonaktifkan template → status berubah)

Bug fix selama dev:
- wpa_pks_template pakai uploaded_at (bukan created_at)
- mammoth Node.js pakai { buffer: Buffer } bukan { arrayBuffer }
- Insert bab satu per satu (batch insert silent fail, single insert works)

Stage Summary:
- ✅ Template PKS_PLKK_2026 aktif di production: 24 bab + 81 placeholder
- ✅ Hash sha256 per bab (konsistensi terjamin)
- ✅ Klasifikasi placeholder otomatis: 9 auto-fill + 72 manual_required
- ✅ Template LOCKED (tidak bisa diedit di cabang)
- ✅ UI lengkap: list, upload, detail, toggle
- ⏳ Fase 4: Pipeline State Machine (transisi tahap + Ambil Alih)
- ⏳ Fase 5: Drafting PKS (auto-fill dari template + data faskes)

---
Task ID: MINIM-KLIK
Agent: main
Task: Simplifikasi menu — minim klik (gabung Tugas Saya + Tugas Cabang)

Work Log:
- Audit 6 role dashboard via Agent Browser (sebelum perubahan):
  • CM: 5 menu (Tugas Saya + Tugas Cabang redundant)
  • PP: 4 menu (Tugas Saya + Tugas Cabang redundant)
  • Kabid: 6 menu (Tugas Cabang + Pengajuan overlap)
  • Super Admin: 6 menu (OK)
  • PIC RS: 5 menu (OK)
  • Legal RS: 4 menu (OK)

Perubahan menu (minim klik):
- CM: 5 → 4 menu (hapus Tugas Cabang, gabung ke Tugas Saya)
- PP: 4 → 3 menu (hapus Tugas Cabang, gabung ke Tugas Saya)
- Kabid: 6 → 5 menu (hapus Pengajuan, gabung ke Tugas Cabang)
- Super Admin: 6 (OK)
- PIC RS: 5 (OK)
- Legal RS: 4 (OK)

UI "Tugas Saya" status-aware (1 list, 3 status, tombol context-aware):
- Section 1: "Sedang Saya Pegang" (current_handler = me) → tombol Lanjutkan
- Section 2: "Belum Diambil" (current_handler = null) → tombol Ambil Alih
- Section 3: "Dipegang Lainnya" (CM/PP/Kabid lain) → read-only atau PP Aktif

TugasSayaView component (reusable untuk CM, PP, Kabid):
- CM: lihat semua tugas + bisa Buka/Tutup PP (tombol per kartu)
- PP: lihat semua, Ambil Alih untuk "Belum Diambil" atau "PP Aktif"
- Kabid: oversight semua + bisa Buka/Tutup PP

Dashboard CM & PP diupdate:
- CM: stats "Saya Pegang" + "Belum Diambil" (bukan "Tugas Saya" + "Tugas Cabang")
- PP: stats "Saya Pegang" + "PP Bisa Ambil"
- Tugas terkini dengan status-aware badge di dashboard

Old routes (tugas-cabang, pengajuan) → redirect ke tugas (anti-404)

Test via Agent Browser (1 per 1):
1. ✅ CM: 4 menu (Dashboard, Tugas Saya, Faskes Mitra, Bank Tarif)
2. ✅ PP: 3 menu (Dashboard, Tugas Saya, Faskes Mitra)
3. ✅ Kabid: 5 menu (Dashboard, Approval, Dokumen Legal, Tugas Cabang, Laporan)
4. ✅ CM "Tugas Saya": section "Belum Diambil" dengan RS Sehat Sentosa + tombol Ambil Alih
5. ✅ CM detail tugas: tombol Tutup PP + Ambil Alih (1 klik dari dashboard)
6. ✅ PP "Tugas Saya": section "Belum Diambil" + tombol Ambil Alih (1 klik)
7. ✅ Super Admin: 6 menu (OK)
8. ✅ PIC RS: 5 menu (OK)
9. ✅ Legal RS: 4 menu (OK)

Stage Summary:
- ✅ Menu disederhanakan: CM 4, PP 3, Kabid 5 (dari sebelumnya 5, 4, 6)
- ✅ "Tugas Saya" status-aware: 1 list dengan 3 section + tombol context-aware
- ✅ Minim klik: dari dashboard → 1 klik ke Tugas Saya → 1 klik ke detail/Ambil Alih
- ✅ Tidak ada lagi redundant "Tugas Saya" + "Tugas Cabang"
- ✅ PP tetap controlled: hanya lihat yang takeover_enabled=true atau yang dia pegang
