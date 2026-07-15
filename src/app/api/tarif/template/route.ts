import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  // Generate Excel template untuk upload tarif faskes
  const data = [
    { kategori: 'kamar', nama_item: 'Kamar VIP', satuan: 'per hari', tarif: 0 },
    { kategori: 'kamar', nama_item: 'Kamar Kelas I', satuan: 'per hari', tarif: 0 },
    { kategori: 'kamar', nama_item: 'Kamar Kelas II', satuan: 'per hari', tarif: 0 },
    { kategori: 'kamar', nama_item: 'Kamar Kelas III', satuan: 'per hari', tarif: 0 },
    { kategori: 'operasi_kecil', nama_item: 'Operasi kecil (contoh: excision bibir)', satuan: 'per tindakan', tarif: 0 },
    { kategori: 'operasi_sedang', nama_item: 'Operasi sedang (contoh: appendectomy)', satuan: 'per tindakan', tarif: 0 },
    { kategori: 'operasi_besar', nama_item: 'Operasi besar (contoh: laparotomi)', satuan: 'per tindakan', tarif: 0 },
    { kategori: 'laboratorium', nama_item: 'Darah lengkap', satuan: 'per item', tarif: 0 },
    { kategori: 'laboratorium', nama_item: 'Urinalisis', satuan: 'per item', tarif: 0 },
    { kategori: 'radiologi', nama_item: 'X-Ray Thorax PA', satuan: 'per item', tarif: 0 },
    { kategori: 'radiologi', nama_item: 'USG Abdomen', satuan: 'per item', tarif: 0 },
    { kategori: 'tindakan_medis', nama_item: 'Konsultasi Spesialis', satuan: 'per kunjungan', tarif: 0 },
    { kategori: 'tindakan_medis', nama_item: 'Konsultasi Umum', satuan: 'per kunjungan', tarif: 0 },
    { kategori: 'rawat_inap', nama_item: 'Biaya administrasi rawat inap', satuan: 'per episode', tarif: 0 },
    { kategori: 'admin', nama_item: 'Biaya pendaftaran rawat jalan', satuan: 'per kunjungan', tarif: 0 },
    { kategori: 'admin', nama_item: 'Biaya administrasi rawat inap (maks 3%)', satuan: 'per episode', tarif: 0 },
    { kategori: 'lainnya', nama_item: 'Ambulans', satuan: 'per perjalanan', tarif: 0 },
  ]
  
  const ws = XLSX.utils.json_to_sheet(data)
  // Set column widths
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 18 }, { wch: 15 }]
  
  // Add header note row (instructions)
  const wsNotes = XLSX.utils.aoa_to_sheet([
    ['Template Upload Tarif Faskes — Mitra PLKK BPJS Ketenagakerjaan'],
    [''],
    ['Instruksi:'],
    ['1. Isi kolom tarif (rupiah) untuk setiap item yang tersedia di faskes Anda'],
    ['2. Hapus baris item yang TIDAK tersedia di faskes Anda'],
    ['3. Boleh tambah baris baru untuk item lain (kolom kategori wajib diisi sesuai enum)'],
    ['4. Kategori yang valid: kamar, operasi_kecil, operasi_sedang, operasi_besar, laboratorium, radiologi, tindakan_medis, rawat_inap, obat, admin, lainnya'],
    ['5. Tarif dalam Rupiah (angka tanpa titik/koma pemisah ribuan), contoh: 500000 bukan 500.000'],
    ['6. Setelah upload, sistem akan otomatis membandingkan dengan tarif acuan kantor cabang'],
    ['7. Status kewajaran: wajar (hijau), perlu_review (kuning), tinggi/rendah (oranye), ekstrem (merah), no_acuan (abu-abu)'],
    [''],
    ['== DATA TARIF =='],
  ])
  
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Instruksi')
  XLSX.utils.book_append_sheet(wb, ws, 'Tarif')
  
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template_tarif_faskes_${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  })
}
