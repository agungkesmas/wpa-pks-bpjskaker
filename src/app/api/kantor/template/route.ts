import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

// GET /api/kantor/template
// Download template Excel untuk batch import kantor cabang
export async function GET() {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Hanya Super Admin/Kabid' }, { status: 403 })
    }

    // Buat worksheet dengan header + 2 contoh row
    const data = [
      { kode: 'KC-BANDUNG', nama: 'BPJS Ketenagakerjaan Cabang Bandung', alamat: 'Jl. ABC No. 123', kota: 'Bandung', provinsi: 'Jawa Barat', telp: '022-123456', email: 'bandung@bpjsketenakerjaan.go.id' },
      { kode: 'KC-SEMARANG', nama: 'BPJS Ketenagakerjaan Cabang Semarang', alamat: 'Jl. XYZ No. 456', kota: 'Semarang', provinsi: 'Jawa Tengah', telp: '024-654321', email: 'semarang@bpjsketenakerjaan.go.id' },
    ]

    const ws = XLSX.utils.json_to_sheet(data)
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // kode
      { wch: 40 }, // nama
      { wch: 30 }, // alamat
      { wch: 15 }, // kota
      { wch: 20 }, // provinsi
      { wch: 15 }, // telp
      { wch: 35 }, // email
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kantor Cabang')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-kantor.xlsx"',
      },
    })
  } catch (e: any) {
    console.error('Template kantor error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
