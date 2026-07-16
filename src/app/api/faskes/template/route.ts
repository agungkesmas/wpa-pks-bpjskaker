import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

// GET /api/faskes/template
// Download template Excel untuk batch upload faskes + PKS + PIC RS
export async function GET() {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'case_manager' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    // Template dengan 3 contoh row
    const data = [
      {
        nama_faskes: 'RSUD Juanda Kuningan',
        jenis_faskes: 'RS',
        tipe_faskes: 'C',
        alamat: 'Jl. Raya Kuningan No. 12',
        kota: 'Kuningan',
        provinsi: 'Jawa Barat',
        telp: '0232-123456',
        email_faskes: 'info@rsjuanda.id',
        npwp: '01.234.567.8-901.000',
        pj_nama: 'Dr. Andi Wijaya, SpOT',
        pj_jabatan: 'Direktur',
        pj_phone: '0812-3456-7890',
        bank_name: 'BRI',
        bank_cabang: 'Kuningan',
        bank_rekening_number: '1234567890',
        bank_rekening_name: 'RSUD Juanda Kuningan',
        kode_pks: 'PKS-001/KC-CIREBON/2024',
        tanggal_mulai_pks: '2024-08-14',
        tanggal_berakhir_pks: '2026-08-14',
        pic_rs_nama: 'Dr. Siti Nurhaliza, SKM',
        pic_rs_email: 'siti@rsjuanda.id',
        pic_rs_phone: '0813-9876-5432',
      },
      {
        nama_faskes: 'RS Mitra Keluarga Cirebon',
        jenis_faskes: 'RS',
        tipe_faskes: 'B',
        alamat: 'Jl. Siliwangi No. 100',
        kota: 'Cirebon',
        provinsi: 'Jawa Barat',
        telp: '0231-456789',
        email_faskes: 'info@rsmk-cirebon.id',
        npwp: '02.345.678.9-012.000',
        pj_nama: 'Dr. Budi Santoso, SpPD',
        pj_jabatan: 'Direktur Utama',
        pj_phone: '0814-5678-9012',
        bank_name: 'BNI',
        bank_cabang: 'Cirebon',
        bank_rekening_number: '0987654321',
        bank_rekening_name: 'RS Mitra Keluarga',
        kode_pks: 'PKS-002/KC-CIREBON/2024',
        tanggal_mulai_pks: '2024-09-01',
        tanggal_berakhir_pks: '2026-09-01',
        pic_rs_nama: 'Rina Marlina, SH',
        pic_rs_email: 'rina@rsmk-cirebon.id',
        pic_rs_phone: '0815-6789-0123',
      },
      {
        nama_faskes: 'Klinik Pratama Sehat',
        jenis_faskes: 'Klinik',
        tipe_faskes: 'Umum',
        alamat: 'Jl. Kartini No. 5',
        kota: 'Cirebon',
        provinsi: 'Jawa Barat',
        telp: '0231-987654',
        email_faskes: '',
        npwp: '',
        pj_nama: 'dr. Wati, M.Kes',
        pj_jabatan: 'Kepala Klinik',
        pj_phone: '0816-7890-1234',
        bank_name: '',
        bank_cabang: '',
        bank_rekening_number: '',
        bank_rekening_name: '',
        kode_pks: 'PKS-003/KC-CIREBON/2025',
        tanggal_mulai_pks: '2025-01-15',
        tanggal_berakhir_pks: '2027-01-15',
        pic_rs_nama: '',
        pic_rs_email: '',
        pic_rs_phone: '',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [
      { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Faskes')

    // Instruction sheet
    const instructions = [
      { petunjuk: 'CARA PENGISIAN:' },
      { petunjuk: '1. Wajib: nama_faskes, jenis_faskes, kota, provinsi, pj_nama, kode_pks, tanggal_mulai_pks, tanggal_berakhir_pks' },
      { petunjuk: '2. jenis_faskes: RS / Klinik / Puskesmas / PraktikMandiri / Lainnya' },
      { petunjuk: '3. tipe_faskes: A / B / C / D / Umum (untuk RS)' },
      { petunjuk: '4. Format tanggal: YYYY-MM-DD (contoh: 2024-08-14)' },
      { petunjuk: '5. PIC RS opsional — kalau diisi (email), sistem auto-create akun PIC RS + generate password' },
      { petunjuk: '6. Kalau faskes/PKS sudah ada di DB → auto-update data' },
      { petunjuk: '7. Kalau PIC RS email sudah ada di DB → skip (tidak duplikat)' },
      { petunjuk: '8. Upload file ini di menu Faskes Mitra → Import Batch' },
    ]
    const wsInstr = XLSX.utils.json_to_sheet(instructions)
    wsInstr['!cols'] = [{ wch: 100 }]
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Petunjuk')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-faskes-batch.xlsx"',
      },
    })
  } catch (e: any) {
    console.error('Template faskes error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
