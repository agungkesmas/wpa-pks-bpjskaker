import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

// GET /api/users/template
// Download template Excel untuk batch import user
export async function GET() {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Hanya Super Admin/Kabid' }, { status: 403 })
    }

    // Buat worksheet dengan header + 3 contoh row
    const data = [
      { nama: 'Dr. Siti Nurhaliza, SKM', email: 'siti.n@bpjs.go.id', role: 'case_manager', wa: '081234567890' },
      { nama: 'Rina Marlina, SH', email: 'rina.m@rsjuanda.id', role: 'legal_rs', wa: '081398765432' },
      { nama: 'Budi Santoso', email: 'budi.s@bpjs.go.id', role: 'penata_pelayanan', wa: '081200011122' },
    ]

    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [
      { wch: 30 }, // nama
      { wch: 30 }, // email
      { wch: 20 }, // role
      { wch: 18 }, // wa
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'User')

    // Add a second sheet with role reference
    const roleRef = [
      { role: 'super_admin', keterangan: 'Super Admin (oversight semua cabang)' },
      { role: 'kepala_bidang', keterangan: 'Kepala Bidang Pelayanan (approval, laporan)' },
      { role: 'case_manager', keterangan: 'Case Manager (handle pipeline, drafting PKS)' },
      { role: 'penata_pelayanan', keterangan: 'Penata Pelayanan (backup CM, dokumen operasional)' },
      { role: 'pic_rs', keterangan: 'PIC RS (ajukan PKS/adendum dari sisi faskes)' },
      { role: 'legal_rs', keterangan: 'Legal RS (review legal dokumen dari sisi faskes)' },
    ]
    const wsRef = XLSX.utils.json_to_sheet(roleRef)
    wsRef['!cols'] = [{ wch: 20 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi Role')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-user.xlsx"',
      },
    })
  } catch (e: any) {
    console.error('Template user error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
