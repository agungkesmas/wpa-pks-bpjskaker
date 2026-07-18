/**
 * Run SQL migration against Supabase via REST API
 * ===============================================
 * Menggunakan Supabase's pg_execute endpoint (database direct query)
 * karena service_role key tidak bisa akses /pg/query di REST normal.
 *
 * Strategy: pakai supabase-js rpc() ke fungsi PostgreSQL,
 * ATAU pakai /rest/v1/rpc/ kalau ada function,
 * ATAU pakai database connection string langsung (psql).
 *
 * Karena Supabase project hfhvsiuebrwrqmqzsroc, kita pakai connection string:
 * postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Tapi kita tidak tahu region. Alternative: pakai REST API untuk insert
 * placeholder satu-satu (sebanyak 91).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// ============================================================
// 91 placeholder definitions (sama dengan SQL migration)
// ============================================================
const PLACEHOLDERS = [
  // IDENTITAS FASKES (12) — auto_clone: true
  ['NAMA_FASKES', 'Nama Faskes', 'manual_required', 'Identitas Faskes', true, 1],
  ['ALAMAT_FASKES', 'Alamat Faskes', 'manual_required', 'Identitas Faskes', true, 2],
  ['JENIS_FASKES', 'Jenis Faskes', 'manual_required', 'Identitas Faskes', true, 3],
  ['BENTUK_FASKES', 'Bentuk Faskes (Pemda/Swasta dll)', 'manual_required', 'Identitas Faskes', true, 4],
  ['WEB_FASKES', 'Website Faskes', 'manual_optional', 'Identitas Faskes', false, 5],
  ['TELP_FAX_FASKES', 'Telp/Fax Faskes', 'manual_required', 'Identitas Faskes', true, 6],
  ['JENIS_AKTA_PENDIRIAN', 'Jenis Akta Pendirian', 'manual_required', 'Identitas Faskes', true, 7],
  ['NOMOR_AKTA_PENDIRIAN', 'Nomor Akta Pendirian', 'manual_required', 'Identitas Faskes', true, 8],
  ['TANGGAL_AKTA_PENDIRIAN', 'Tanggal Akta Pendirian', 'manual_required', 'Identitas Faskes', true, 9],
  ['NAMA_PENANDATANGAN_PIHAK_KEDUA', 'Nama Penandatangan Pihak Kedua (Faskes)', 'manual_required', 'Identitas Faskes', true, 10],
  ['JABATAN_PENANDATANGAN_PIHAK_KEDUA', 'Jabatan Penandatangan Pihak Kedua', 'manual_required', 'Identitas Faskes', true, 11],
  ['DASAR_KEWENANGAN_PIHAK_KEDUA', 'Dasar Kewenangan Pihak Kedua', 'manual_required', 'Identitas Faskes', true, 12],

  // IDENTITAS BPJS (9) — auto_clone: true
  ['NAMA_KANTOR_CABANG', 'Nama Kantor Cabang BPJS', 'manual_required', 'Identitas BPJS', true, 13],
  ['ALAMAT_KANTOR_CABANG', 'Alamat Kantor Cabang BPJS', 'manual_required', 'Identitas BPJS', true, 14],
  ['NAMA_KEPALA_KANTOR_CABANG', 'Nama Kepala Kantor Cabang', 'manual_required', 'Identitas BPJS', true, 15],
  ['JABATAN_PENANDATANGAN_PIHAK_PERTAMA', 'Jabatan Penandatangan Pihak Pertama (BPJS)', 'manual_required', 'Identitas BPJS', true, 16],
  ['TELP_FAX_BPJS', 'Telp/Fax BPJS', 'manual_required', 'Identitas BPJS', true, 17],
  ['NOMOR_KEP_DIREKSI', 'Nomor Kep Direksi', 'manual_required', 'Identitas BPJS', true, 18],
  ['JUDUL_KEP_DIREKSI', 'Judul Kep Direksi', 'manual_required', 'Identitas BPJS', true, 19],
  ['NOMOR_SURAT_KUASA', 'Nomor Surat Kuasa', 'manual_required', 'Identitas BPJS', true, 20],
  ['TANGGAL_SURAT_KUASA', 'Tanggal Surat Kuasa', 'manual_required', 'Identitas BPJS', true, 21],

  // NOMOR & TANGGAL PKS (9) — auto_clone: false
  ['NOMOR_PKS_PIHAK_PERTAMA', 'Nomor PKS Pihak Pertama (BPJS)', 'manual_required', 'Nomor & Tanggal PKS', true, 22],
  ['NOMOR_PKS_PIHAK_KEDUA', 'Nomor PKS Pihak Kedua (Faskes)', 'manual_required', 'Nomor & Tanggal PKS', true, 23],
  ['HARI_TANDA_TANGAN', 'Hari Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 24],
  ['TANGGAL_TANDA_TANGAN', 'Tanggal Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 25],
  ['BULAN_TANDA_TANGAN', 'Bulan Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 26],
  ['TAHUN_TANDA_TANGAN', 'Tahun Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 27],
  ['KOTA_TANDA_TANGAN', 'Kota Tanda Tangan', 'manual_required', 'Nomor & Tanggal PKS', true, 28],
  ['TANGGAL_MULAI_PKS', 'Tanggal Mulai PKS', 'manual_required', 'Nomor & Tanggal PKS', true, 29],
  ['TANGGAL_BERAKHIR_PKS', 'Tanggal Berakhir PKS', 'manual_required', 'Nomor & Tanggal PKS', true, 30],

  // PKS SEBELUMNYA (4) — auto_clone: false
  ['NOMOR_PKS_SEBELUMNYA_PIHAK_PERTAMA', 'Nomor PKS Sebelumnya Pihak Pertama', 'manual_optional', 'PKS Sebelumnya', false, 31],
  ['NOMOR_PKS_SEBELUMNYA_PIHAK_KEDUA', 'Nomor PKS Sebelumnya Pihak Kedua', 'manual_optional', 'PKS Sebelumnya', false, 32],
  ['PERIHAL_PKS_SEBELUMNYA', 'Perihal PKS Sebelumnya', 'manual_optional', 'PKS Sebelumnya', false, 33],
  ['TANGGAL_BERAKHIR_PKS_SEBELUMNYA', 'Tanggal Berakhir PKS Sebelumnya', 'manual_optional', 'PKS Sebelumnya', false, 34],

  // BANK (4) — auto_clone: true
  ['NAMA_BANK', 'Nama Bank', 'manual_required', 'Bank', true, 35],
  ['CABANG_BANK', 'Cabang Bank', 'manual_required', 'Bank', true, 36],
  ['NOMOR_REKENING', 'Nomor Rekening', 'manual_required', 'Bank', true, 37],
  ['NAMA_REKENING', 'Nama Rekening', 'manual_required', 'Bank', true, 38],

  // TARIF (4) — auto_clone: false
  ['JENIS_TARIF_KK_PAK', 'Jenis Tarif KK Pakai', 'manual_required', 'Tarif', true, 39],
  ['KELAS_RAWAT_INAP_KK_PAK', 'Kelas Rawat Inap KK Pakai', 'manual_required', 'Tarif', true, 40],
  ['NAMA_RS_PEMERINTAH_ACUAN', 'Nama RS Pemerintah Acuan', 'manual_optional', 'Tarif', false, 41],
  ['TAHUN_TARIF_NEGOSIASI', 'Tahun Tarif Negosiasi', 'manual_required', 'Tarif', true, 42],

  // BA NEGOSIASI (13) — auto_clone: false
  ['NOMOR_BA_NEGOSIASI', 'Nomor BA Negosiasi', 'manual_required', 'BA Negosiasi', true, 43],
  ['HARI_NEGOSIASI', 'Hari Negosiasi', 'manual_required', 'BA Negosiasi', true, 44],
  ['TANGGAL_NEGOSIASI', 'Tanggal Negosiasi', 'manual_required', 'BA Negosiasi', true, 45],
  ['BULAN_NEGOSIASI', 'Bulan Negosiasi', 'manual_required', 'BA Negosiasi', true, 46],
  ['TAHUN_NEGOSIASI', 'Tahun Negosiasi', 'manual_required', 'BA Negosiasi', true, 47],
  ['JAM_NEGOSIASI', 'Jam Negosiasi', 'manual_required', 'BA Negosiasi', true, 48],
  ['TANGGAL_PENAWARAN', 'Tanggal Penawaran', 'manual_required', 'BA Negosiasi', true, 49],
  ['BULAN_PENAWARAN', 'Bulan Penawaran', 'manual_required', 'BA Negosiasi', true, 50],
  ['TAHUN_PENAWARAN', 'Tahun Penawaran', 'manual_required', 'BA Negosiasi', true, 51],
  ['NAMA_SAKSI_PIHAK_PERTAMA', 'Nama Saksi Pihak Pertama', 'manual_required', 'BA Negosiasi', true, 52],
  ['JABATAN_SAKSI_PIHAK_PERTAMA', 'Jabatan Saksi Pihak Pertama', 'manual_required', 'BA Negosiasi', true, 53],
  ['NAMA_SAKSI_PIHAK_KEDUA', 'Nama Saksi Pihak Kedua', 'manual_required', 'BA Negosiasi', true, 54],
  ['JABATAN_SAKSI_PIHAK_KEDUA', 'Jabatan Saksi Pihak Kedua', 'manual_required', 'BA Negosiasi', true, 55],

  // BA REKONSILIASI (6) — auto_clone: false
  ['NOMOR_BA_REKONSILIASI', 'Nomor BA Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 56],
  ['TANGGAL_REKONSILIASI', 'Tanggal Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 57],
  ['BULAN_REKONSILIASI', 'Bulan Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 58],
  ['TAHUN_REKONSILIASI', 'Tahun Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 59],
  ['BULAN_AWAL_REKONSILIASI', 'Bulan Awal Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 60],
  ['BULAN_AKHIR_REKONSILIASI', 'Bulan Akhir Rekonsiliasi', 'manual_optional', 'Rekonsiliasi', false, 61],

  // INFORMASI KELENGKAPAN (8) — auto_clone: false
  ['NOMOR_INFORMASI_KELENGKAPAN', 'Nomor Informasi Kelengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 62],
  ['TANGGAL_INFORMASI_KELENGKAPAN', 'Tanggal Informasi Kelengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 63],
  ['BULAN_INFORMASI_KELENGKAPAN', 'Bulan Informasi Kelengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 64],
  ['TAHUN_INFORMASI_KELENGKAPAN', 'Tahun Informasi Kelengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 65],
  ['BULAN_PELAYANAN', 'Bulan Pelayanan', 'manual_optional', 'Informasi Kelengkapan', false, 66],
  ['TAHUN_PELAYANAN', 'Tahun Pelayanan', 'manual_optional', 'Informasi Kelengkapan', false, 67],
  ['JUMLAH_KASUS_TIDAK_LENGKAP', 'Jumlah Kasus Tidak Lengkap', 'manual_optional', 'Informasi Kelengkapan', false, 68],
  ['BATAS_HARI_PENLENGKAPAN', 'Batas Hari Penlengkapan', 'manual_optional', 'Informasi Kelengkapan', false, 69],

  // PIC & KONTAK (16) — auto_clone: true
  ['NAMA_PIC_USER_EPLKK', 'Nama PIC User EPLKK', 'manual_required', 'PIC & Kontak', true, 70],
  ['JABATAN_PIC_USER_EPLKK', 'Jabatan PIC User EPLKK', 'manual_required', 'PIC & Kontak', true, 71],
  ['NAMA_PIC_NARAHUBUNG', 'Nama PIC Narahubung', 'manual_required', 'PIC & Kontak', true, 72],
  ['JABATAN_PIC_NARAHUBUNG', 'Jabatan PIC Narahubung', 'manual_required', 'PIC & Kontak', true, 73],
  ['NAMA_PIC_BPJS', 'Nama PIC BPJS', 'manual_required', 'PIC & Kontak', true, 74],
  ['JABATAN_PIC_BPJS', 'Jabatan PIC BPJS', 'manual_required', 'PIC & Kontak', true, 75],
  ['HP_PIC_BPJS', 'HP PIC BPJS', 'manual_required', 'PIC & Kontak', true, 76],
  ['EMAIL_PIC_BPJS', 'Email PIC BPJS', 'manual_required', 'PIC & Kontak', true, 77],
  ['NAMA_PIC_ADMIN_FASKES', 'Nama PIC Admin Faskes', 'manual_required', 'PIC & Kontak', true, 78],
  ['JABATAN_PIC_ADMIN_FASKES', 'Jabatan PIC Admin Faskes', 'manual_required', 'PIC & Kontak', true, 79],
  ['HP_PIC_ADMIN_FASKES', 'HP PIC Admin Faskes', 'manual_required', 'PIC & Kontak', true, 80],
  ['EMAIL_PIC_ADMIN_FASKES', 'Email PIC Admin Faskes', 'manual_required', 'PIC & Kontak', true, 81],
  ['NAMA_PIC_KLINIS_FASKES', 'Nama PIC Klinis Faskes', 'manual_required', 'PIC & Kontak', true, 82],
  ['JABATAN_PIC_KLINIS_FASKES', 'Jabatan PIC Klinis Faskes', 'manual_required', 'PIC & Kontak', true, 83],
  ['HP_PIC_KLINIS_FASKES', 'HP PIC Klinis Faskes', 'manual_required', 'PIC & Kontak', true, 84],
  ['EMAIL_PIC_KLINIS_FASKES', 'Email PIC Klinis Faskes', 'manual_required', 'PIC & Kontak', true, 85],

  // PAKTA & LAINNYA (6) — mixed
  ['TEMPAT_PAKTA', 'Tempat Pakta', 'manual_required', 'Pakta & Lainnya', true, 86],
  ['BULAN_PAKTA', 'Bulan Pakta', 'manual_required', 'Pakta & Lainnya', true, 87],
  ['TAHUN_PAKTA', 'Tahun Pakta', 'manual_required', 'Pakta & Lainnya', true, 88],
  ['NAMA_PIMPINAN_FASKES', 'Nama Pimpinan Faskes', 'manual_required', 'Pakta & Lainnya', true, 89],
  ['JABATAN_PIMPINAN_FASKES', 'Jabatan Pimpinan Faskes', 'manual_required', 'Pakta & Lainnya', true, 90],
  ['KOTA_PENGADILAN_NEGERI', 'Kota Pengadilan Negeri', 'manual_required', 'Pakta & Lainnya', true, 91],
] as const

async function main() {
  console.log('🚀 Run SQL Migration via Supabase REST API')
  console.log('==========================================')

  // 1. Hapus placeholder definitions lama
  console.log('\n1. Hapus placeholder lama...')
  const { error: delPHErr } = await supabase
    .from('wpa_pks_template_placeholder')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')  // delete all
  if (delPHErr) {
    console.error('❌ Gagal hapus placeholder lama:', delPHErr.message)
    console.error('Details:', delPHErr)
  } else {
    console.log('   ✅ Placeholder lama dihapus')
  }

  // 2. Hapus template records lama
  console.log('\n2. Hapus template lama...')
  const { error: delTErr } = await supabase
    .from('wpa_pks_template')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (delTErr) {
    console.error('❌ Gagal hapus template lama:', delTErr.message)
  } else {
    console.log('   ✅ Template lama dihapus')
  }

  // 3. Insert template baru (schema: kode, nama, version TEXT, file_docx_path, is_active, jenis_dokumen)
  console.log('\n3. Insert template baru...')
  const { data: newTpl, error: insErr } = await supabase
    .from('wpa_pks_template')
    .insert({
      kode: 'TPL-PKS-BERSIH-2026',
      nama: 'PKS PLKK 2026 - Template Bersih',
      version: '2026.1',
      file_docx_path: 'templates/pks_template_bersih.docx',
      is_active: true,
      jenis_dokumen: 'pks',
    })
    .select()
    .single()
  if (insErr || !newTpl) {
    console.error('❌ Gagal insert template:', insErr?.message)
    process.exit(1)
  }
  console.log(`   ✅ Template baru: ${newTpl.id}`)

  // 4. Insert 91 placeholders (schema: template_id, key, label, tipe, kategori, required, urutan)
  console.log('\n4. Insert 91 placeholders...')
  const rows = PLACEHOLDERS.map(([key, label, tipe, kategori, is_wajib, urutan]) => ({
    template_id: newTpl.id,
    key,
    label,
    tipe,
    kategori,
    required: is_wajib,
    urutan,
  }))

  // Insert batch 50 per batch (Supabase limit)
  const BATCH_SIZE = 50
  let insertedCount = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { data: inserted, error: bErr } = await supabase
      .from('wpa_pks_template_placeholder')
      .insert(batch)
      .select('id')
    if (bErr) {
      console.error(`❌ Gagal insert batch ${i / BATCH_SIZE + 1}:`, bErr.message)
      console.error('Sample row:', batch[0])
      process.exit(1)
    }
    insertedCount += inserted?.length || 0
    console.log(`   Batch ${i / BATCH_SIZE + 1}: +${inserted?.length || 0} (total: ${insertedCount})`)
  }

  console.log(`   ✅ Total ${insertedCount} placeholder inserted`)

  // 5. Verify
  console.log('\n5. Verify migration...')
  const { count: tplCount } = await supabase
    .from('wpa_pks_template')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  console.log(`   wpa_pks_template (active): ${tplCount}`)

  const { count: phCount } = await supabase
    .from('wpa_pks_template_placeholder')
    .select('*', { count: 'exact', head: true })
    .eq('template_id', newTpl.id)
  console.log(`   wpa_pks_template_placeholder: ${phCount}`)

  console.log('\n✅ Migration selesai!')
  console.log(`   Template ID: ${newTpl.id}`)
  console.log(`   Storage path: templates/pks_template_bersih.docx`)
  console.log(`   Placeholders: ${phCount}`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
