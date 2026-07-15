-- ============================================================
-- MIGRATION: Tarif Acuan Standar + Template 50+ Item
-- ============================================================

-- 1. Tambah kolom kode_item + tarif_acuan_provinsi
alter table wpa_tarif_acuan
  add column if not exists kode_item text,
  add column if not exists tarif_acuan_provinsi numeric(14,2);

comment on column wpa_tarif_acuan.kode_item is 'Kode standar item tarif (contoh: IGD-001, RIN-001). Dari template standar BPJS.';
comment on column wpa_tarif_acuan.tarif_acuan_provinsi is 'Ceiling price dari provinsi (harga tertinggi yang dibayar BPJS). Sumber: Permenaker/Perda.';

-- 2. Seed template standar 50+ item (tarif kosong, CM yang isi)
-- Item ini akan jadi referensi standar untuk semua kantor cabang
-- CM tinggal isi tarif_acuan_provinsi (ceiling) atau upload survey RS

-- Catatan: seed ini menggunakan ON CONFLICT DO NOTHING supaya tidak overwrite
-- Kalau CM sudah punya item dengan nama yang sama, skip

-- ============================================================
-- TEMPLATE STANDAR — 50+ Item (8 Kategori)
-- ============================================================
-- Insert dengan kantor_cabang_id = null (template global)
-- CM copy template ini ke kantor cabang mereka saat first setup

-- Kita buat tabel khusus untuk template standar (bukan di wpa_tarif_acuan)
-- supaya tidak campur dengan data cabang
create table if not exists wpa_tarif_template_standar (
  id uuid primary key default gen_random_uuid(),
  kode_item text unique not null,
  kategori text not null,
  nama_item_standar text not null,
  nama_item_alias text[] default '{}',
  satuan text,
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_wpa_tarif_template_kode on wpa_tarif_template_standar(kode_item);
create index if not exists idx_wpa_tarif_template_kategori on wpa_tarif_template_standar(kategori);

-- Seed 50+ item standar
insert into wpa_tarif_template_standar (kode_item, kategori, nama_item_standar, nama_item_alias, satuan) values
  -- A. RAWAT DARURAT / IGD (8 item)
  ('IGD-001', 'rawat_darurat', 'IGD Dewasa — Tindakan Awal', '{IGD, UGD, Emergency, Instalasi Gawat Darurat}', 'per kunjungan'),
  ('IGD-002', 'rawat_darurat', 'IGD Anak', '{IGD Anak, Emergency Anak}', 'per kunjungan'),
  ('IGD-003', 'rawat_darurat', 'Resusitasi Jantung Paru (RJP)', '{CPR, Resusitasi}', 'per tindakan'),
  ('IGD-004', 'rawat_darurat', 'Penanganan Syok', '{Syok, Shock Treatment}', 'per tindakan'),
  ('IGD-005', 'rawat_darurat', 'Pemberhentian Perdarahan Darurat', '{Hemostasis, Stop Bleeding}', 'per tindakan'),
  ('IGD-006', 'rawat_darurat', 'Splinting / Bidai Darurat', '{Bidai, Splint, Gips Darurat}', 'per tindakan'),
  ('IGD-007', 'rawat_darurat', 'Stabilisasi Fraktur', '{Fraktur Stabilization}', 'per tindakan'),
  ('IGD-008', 'rawat_darurat', 'Intubasi Darurat', '{Intubasi, ETT}', 'per tindakan'),

  -- B. RAWAT JALAN / POLIKLINIK (11 item)
  ('RJL-001', 'rawat_jalan', 'Poliklinik Umum', '{Poli Umum, Rawat Jalan Umum}', 'per kunjungan'),
  ('RJL-002', 'rawat_jalan', 'Poliklinik Spesialis Bedah', '{Poli Bedah, Bedah Umum}', 'per kunjungan'),
  ('RJL-003', 'rawat_jalan', 'Poliklinik Spesialis Ortopedi', '{Poli Ortopedi, Traumatologi}', 'per kunjungan'),
  ('RJL-004', 'rawat_jalan', 'Poliklinik Spesialis Saraf', '{Poli Saraf, Neurologi}', 'per kunjungan'),
  ('RJL-005', 'rawat_jalan', 'Poliklinik Spesialis Mata', '{Poli Mata, Oftalmologi}', 'per kunjungan'),
  ('RJL-006', 'rawat_jalan', 'Poliklinik Spesialis THT', '{Poli THT, ENT}', 'per kunjungan'),
  ('RJL-007', 'rawat_jalan', 'Poliklinik Spesialis Penyakit Dalam', '{Poli Penyakit Dalam, Internis}', 'per kunjungan'),
  ('RJL-008', 'rawat_jalan', 'Poliklinik Bedah Plastik', '{Poli Plastik, Rekonstruksi}', 'per kunjungan'),
  ('RJL-009', 'rawat_jalan', 'Poliklinik Rehabilitasi Medik', '{Poli Rehab, Fisioterapi Poli}', 'per kunjungan'),
  ('RJL-010', 'rawat_jalan', 'Visite Dokter Spesialis', '{Visite Spesialis, Konsultasi Spesialis}', 'per kunjungan'),
  ('RJL-011', 'rawat_jalan', 'Visite Dokter Umum', '{Visite Umum}', 'per kunjungan'),

  -- C. TINDAKAN MEDIS — LUKA & JAHIT (12 item)
  ('TMD-001', 'tindakan_medis', 'Cuci Luka', '{Wound Irrigation, Wound Cleaning, Toile Luka}', 'per tindakan'),
  ('TMD-002', 'tindakan_medis', 'Jahit Luka ≤ 5 cm', '{Suturing Minor, Jahit Luka Kecil}', 'per tindakan'),
  ('TMD-003', 'tindakan_medis', 'Jahit Luka 5-10 cm', '{Suturing Moderate, Jahit Luka Sedang}', 'per tindakan'),
  ('TMD-004', 'tindakan_medis', 'Jahit Luka > 10 cm', '{Suturing Major, Jahit Luka Besar}', 'per tindakan'),
  ('TMD-005', 'tindakan_medis', 'Jahit Luka Kompleks (wajah, tangan)', '{Suturing Complex, Jahit Luka Kompleks}', 'per tindakan'),
  ('TMD-006', 'tindakan_medis', 'Eksisi Lesi/Jaringan', '{Excision, Eksisi}', 'per tindakan'),
  ('TMD-007', 'tindakan_medis', 'Insisi & Drainase Abses', '{I&D, Incision Drainage}', 'per tindakan'),
  ('TMD-008', 'tindakan_medis', 'Ekstraksi Benda Asing Superficial', '{Foreign Body Removal, Benda Asing}', 'per tindakan'),
  ('TMD-009', 'tindakan_medis', 'Ekstraksi Benda Asing Dalam', '{Foreign Body Deep, Benda Asing Dalam}', 'per tindakan'),
  ('TMD-010', 'tindakan_medis', 'Debridement Luka', '{Debridement, Pembersihan Jaringan Mati}', 'per tindakan'),
  ('TMD-011', 'tindakan_medis', 'Ganti Balut', '{Balut, Dressing, Ganti Verban}', 'per tindakan'),
  ('TMD-012', 'tindakan_medis', 'Wound Closure (Dermabond/Strip)', '{Skin Closure, Steristrip}', 'per tindakan'),

  -- D. FRAKTUR & ORTOPEDI (10 item)
  ('ORT-001', 'ortopedi', 'Reduksi Tertutup Fraktur', '{Closed Reduction, Reposisi Fraktur}', 'per tindakan'),
  ('ORT-002', 'ortopedi', 'Reduksi Terbuka Fraktur (ORIF)', '{Open Reduction, ORIF, Operasi Patah Tulang}', 'per tindakan'),
  ('ORT-003', 'ortopedi', 'Pemasangan Gips', '{Gips, Cast, Plaster}', 'per tindakan'),
  ('ORT-004', 'ortopedi', 'Pemasangan Bidai/Slab', '{Slab, Bidai, Backslab}', 'per tindakan'),
  ('ORT-005', 'ortopedi', 'Pemasangan Traksi', '{Traksi, Traction}', 'per hari'),
  ('ORT-006', 'ortopedi', 'Eksternal Fixator', '{External Fixation, EF}', 'per tindakan'),
  ('ORT-007', 'ortopedi', 'Internal Fixator (Plate/Screw)', '{ORIF Plate, Internal Fixation}', 'per tindakan'),
  ('ORT-008', 'ortopedi', 'K-Wire / Pinning', '{Kirschner Wire, Pinning}', 'per tindakan'),
  ('ORT-009', 'ortopedi', 'Arthrocentesis (Pungsi Sendi)', '{Joint Aspiration, Pungsi Sendi}', 'per tindakan'),
  ('ORT-010', 'ortopedi', 'Infiltrasi Sendi (Steroid)', '{Joint Injection, Suntik Sendi}', 'per tindakan'),

  -- E. RAWAT INAP (8 item)
  ('RIN-001', 'rawat_inap', 'Rawat Inap Kelas VIP', '{VIP, VIP Room, Kelas VIP}', 'per hari'),
  ('RIN-002', 'rawat_inap', 'Rawat Inap Kelas 1', '{Kelas 1, Class 1}', 'per hari'),
  ('RIN-003', 'rawat_inap', 'Rawat Inap Kelas 2', '{Kelas 2, Class 2}', 'per hari'),
  ('RIN-004', 'rawat_inap', 'Rawat Inap Kelas 3', '{Kelas 3, Class 3}', 'per hari'),
  ('RIN-005', 'rawat_inap', 'ICU (Intensive Care Unit)', '{ICU, Perawatan Intensif}', 'per hari'),
  ('RIN-006', 'rawat_inap', 'ICCU (Intensive Coronary Care)', '{ICCU, CCU}', 'per hari'),
  ('RIN-007', 'rawat_inap', 'Ruang Isolasi', '{Isolasi, Isolation Room}', 'per hari'),
  ('RIN-008', 'rawat_inap', 'Ruang Luka Bakar', '{Burn Unit, Ruang Luka Bakar}', 'per hari'),

  -- F. PENUNJANG DIAGNOSTIK (11 item)
  ('DGK-001', 'diagnostik', 'X-Ray / Radiologi Konvensional', '{X-Ray, Rontgen, Radiologi}', 'per pemeriksaan'),
  ('DGK-002', 'diagnostik', 'USG (Ultrasonografi)', '{USG, Ultrasonography}', 'per pemeriksaan'),
  ('DGK-003', 'diagnostik', 'CT Scan Kepala', '{CT Scan, CT Head}', 'per pemeriksaan'),
  ('DGK-004', 'diagnostik', 'CT Scan Toraks/Abdomen', '{CT Scan Toraks, CT Scan Abdomen}', 'per pemeriksaan'),
  ('DGK-005', 'diagnostik', 'MRI', '{MRI, Magnetic Resonance}', 'per pemeriksaan'),
  ('DGK-006', 'diagnostik', 'EKG (Elektrokardiografi)', '{EKG, ECG, Jantung}', 'per pemeriksaan'),
  ('DGK-007', 'diagnostik', 'Laboratorium Darah Rutin', '{Lab Darah, CBC, Darah Lengkap}', 'per pemeriksaan'),
  ('DGK-008', 'diagnostik', 'Laboratorium Kimia Darah', '{Lab Kimia, Chemistry Panel}', 'per pemeriksaan'),
  ('DGK-009', 'diagnostik', 'Laboratorium Toksikologi', '{Lab Toksikologi, Racun}', 'per pemeriksaan'),
  ('DGK-010', 'diagnostik', 'Spirometri', '{Spirometri, Fungsi Paru}', 'per pemeriksaan'),
  ('DGK-011', 'diagnostik', 'Audiometri', '{Audiometri, Pendengaran}', 'per pemeriksaan'),

  -- G. FARMASI (6 item)
  ('FRM-001', 'farmasi', 'Obat Rasional (R/)', '{Obat, Resep, Farmasi}', 'per item'),
  ('FRM-002', 'farmasi', 'Cairan Infus', '{Infus, IV Fluid, Drip}', 'per botol'),
  ('FRM-003', 'farmasi', 'Imunisasi Tetanus Toxoid', '{TT, Tetanus, Anti-Tetanus}', 'per tindakan'),
  ('FRM-004', 'farmasi', 'Antibiotik Injeksi', '{Antibiotik Suntik, IV Antibiotic}', 'per dosis'),
  ('FRM-005', 'farmasi', 'Analgesik Injeksi', '{Painkiller Suntik, Analgesik IV}', 'per dosis'),
  ('FRM-006', 'farmasi', 'Imunoglobulin Anti-Tetanus (TIG)', '{TIG, ATS}', 'per tindakan'),

  -- H. REHABILITASI & ALAT BANTU (5 item)
  ('RHB-001', 'rehabilitasi', 'Fisioterapi', '{Fisio, Physiotherapy}', 'per sesi'),
  ('RHB-002', 'rehabilitasi', 'Rehabilitasi Medik', '{Rehab Medik, Rehabilitasi}', 'per sesi'),
  ('RHB-003', 'rehabilitasi', 'Alat Bantu (Kruk/Kursi Roda)', '{Kruk, Wheelchair, Alat Bantu}', 'per unit'),
  ('RHB-004', 'rehabilitasi', 'Orthesis/Prosthesis', '{Ortesis, Protesis, Kaki Palsu}', 'per unit'),
  ('RHB-005', 'rehabilitasi', 'Rehabilitasi Vokasional', '{Vocational Rehab, Rehab Vokasional}', 'per program'),

  -- I. LAIN-LAIN (4 item)
  ('LNN-001', 'lainnya', 'Ambulans', '{Ambulance, Transport Pasien}', 'per perjalanan'),
  ('LNN-002', 'lainnya', 'Konsultasi Antar Spesialis', '{Konsul Spesialis, MDT}', 'per konsultasi'),
  ('LNN-003', 'lainnya', 'Oksigen Terapi', '{O2, Oxygen Therapy}', 'per jam'),
  ('LNN-004', 'lainnya', 'Transfusi Darah', '{Transfusi, Blood Transfusion}', 'per unit')
on conflict (kode_item) do nothing;

-- 3. Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- 4. Verifikasi
select kategori, count(*) as total
from wpa_tarif_template_standar
group by kategori
order by kategori;
