import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { PKS_PLACEHOLDERS } from '@/lib/pks-placeholders'

// GET /api/faskes/template
// Download template Excel untuk batch upload faskes
// Kolom: nama_faskes + jenis_faskes + kota + kode_pks + tanggal_mulai_pks + tanggal_berakhir_pks
//        + 81 placeholder PKS (NAMA_FASKES, ALAMAT_FASKES, dst)
export async function GET() {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Build template row: base columns + all 81 placeholder keys
    const exampleRow: Record<string, string> = {
      nama_faskes: 'RSUD Juanda Kuningan',
      jenis_faskes: 'RS',
      tipe_faskes: 'C',
      kota: 'Kuningan',
      provinsi: 'Jawa Barat',
      kode_pks: 'PKS-001/KC-CIREBON/2024',
      tanggal_mulai_pks: '2024-08-14',
      tanggal_berakhir_pks: '2026-08-14',
    }

    // Add all 81 placeholder keys as columns
    for (const p of PKS_PLACEHOLDERS) {
      // Beri contoh nilai untuk beberapa key utama
      const examples: Record<string, string> = {
        NAMA_FASKES: 'RSUD Juanda Kuningan',
        ALAMAT_FASKES: 'Jl. Raya Kuningan No. 12',
        JENIS_FASKES: 'Rumah Sakit',
        BENTUK_FASKES: 'Pemerintah Daerah',
        NAMA_KANTOR_CABANG: 'BPJS Ketenagakerjaan Cabang Cirebon',
        ALAMAT_KANTOR_CABANG: 'Jl. Siliwangi No. 1, Cirebon',
        NAMA_BANK: 'BRI',
        CABANG_BANK: 'Kuningan',
        NOMOR_REKENING: '1234567890',
        NAMA_REKENING: 'RSUD Juanda Kuningan',
        NOMOR_PKS_PIHAK_PERTAMA: 'PKS-001/KC-CIREBON/2024',
        TANGGAL_MULAI_PKS: '2024-08-14',
        TANGGAL_BERAKHIR_PKS: '2026-08-14',
        KOTA_TANDA_TANGAN: 'Cirebon',
      }
      exampleRow[p.key] = examples[p.key] || ''
    }

    const data = [exampleRow]

    const ws = XLSX.utils.json_to_sheet(data)

    // Set column widths — base columns + placeholder columns
    const cols = [
      { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 15 },
      { wch: 25 }, { wch: 15 }, { wch: 15 },
    ]
    for (let i = 0; i < PKS_PLACEHOLDERS.length; i++) {
      cols.push({ wch: 25 })
    }
    ws['!cols'] = cols

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Faskes + PKS')

    // Sheet 2: Daftar Placeholder (reference)
    const placeholderRef = PKS_PLACEHOLDERS.map(p => ({
      key: p.key,
      label: p.label,
      kategori: p.kategori,
      auto_clone: p.auto_clone ? 'YA (ikut perpanjangan)' : 'TIDAK (diisi baru)',
    }))
    const wsRef = XLSX.utils.json_to_sheet(placeholderRef)
    wsRef['!cols'] = [{ wch: 35 }, { wch: 40 }, { wch: 25 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Daftar Placeholder (81)')

    // Sheet 3: Petunjuk
    const instructions = [
      { petunjuk: 'CARA PENGISIAN TEMPLATE BATCH UPLOAD FASKES:' },
      { petunjuk: '' },
      { petunjuk: 'Sheet "Data Faskes + PKS":' },
      { petunjuk: '1. Isi 1 row per faskes. Kolom wajib: nama_faskes, jenis_faskes, kota, provinsi, kode_pks, tanggal_mulai_pks, tanggal_berakhir_pks' },
      { petunjuk: '2. Kolom NAMA_FASKES, ALAMAT_FASKES, dst (81 placeholder) = data dari PKS yang sudah jadi' },
      { petunjuk: '3. Isi SEMUA placeholder yang Anda punya datanya. Kosongkan yang tidak tahu.' },
      { petunjuk: '4. jenis_faskes: RS / Klinik / Puskesmas / PraktikMandiri / Lainnya' },
      { petunjuk: '5. Format tanggal: YYYY-MM-DD (contoh: 2024-08-14)' },
      { petunjuk: '6. Upload di menu Faskes Mitra → Import Batch' },
      { petunjuk: '' },
      { petunjuk: 'Sheet "Daftar Placeholder (81)":' },
      { petunjuk: 'Daftar lengkap 81 placeholder PKS. Kolom auto_clone menandakan apakah nilai ikut di-clone saat perpanjangan.' },
      { petunjuk: 'YA = nilai ikut saat perpanjangan (nama, alamat, bank, dll)' },
      { petunjuk: 'TIDAK = diisi baru saat perpanjangan (nomor PKS, tanggal, tarif)' },
      { petunjuk: '' },
      { petunjuk: 'INI ADALAH MIGRASI SEKALI PAKAI. Setelah upload, data tersimpan di database.' },
      { petunjuk: 'Saat faskes ajukan perpanjangan, 80% data sudah ter-clone otomatis.' },
    ]
    const wsInstr = XLSX.utils.json_to_sheet(instructions)
    wsInstr['!cols'] = [{ wch: 120 }]
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Petunjuk')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-faskes-batch-81-placeholder.xlsx"',
      },
    })
  } catch (e: any) {
    console.error('Template faskes error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
