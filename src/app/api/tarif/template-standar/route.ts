import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

// GET /api/tarif/template-standar?mode=provinsi|daerah
// Download template Excel dengan 50+ item standar pre-filled
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') || 'provinsi'  // 'provinsi' or 'daerah'

    // Fetch template standar from DB
    const { data: templates, error } = await supabaseAdmin
      .from('wpa_tarif_template_standar')
      .select('kode_item, kategori, nama_item_standar, nama_item_alias, satuan')
      .eq('is_active', true)
      .order('kategori', { ascending: true })
      .order('kode_item', { ascending: true })

    if (error) throw error
    if (!templates || templates.length === 0) {
      return NextResponse.json({ error: 'Template standar belum di-seed. Jalankan SQL migration.' }, { status: 500 })
    }

    let data: any[] = []

    if (mode === 'daerah') {
      // Mode rata-rata daerah: kolom RS_1, RS_2, RS_3
      data = templates.map(t => ({
        kategori: t.kategori,
        kode_item: t.kode_item,
        nama_item_standar: t.nama_item_standar,
        nama_item_alias: Array.isArray(t.nama_item_alias) ? t.nama_item_alias.join(', ') : '',
        satuan: t.satuan || '',
        RS_1_nama: '',
        RS_1_tarif: '',
        RS_2_nama: '',
        RS_2_tarif: '',
        RS_3_nama: '',
        RS_3_tarif: '',
        catatan: '',
      }))
    } else {
      // Mode provinsi: kolom tarif_acuan_provinsi (ceiling)
      data = templates.map(t => ({
        kategori: t.kategori,
        kode_item: t.kode_item,
        nama_item_standar: t.nama_item_standar,
        nama_item_alias: Array.isArray(t.nama_item_alias) ? t.nama_item_alias.join(', ') : '',
        satuan: t.satuan || '',
        tarif_acuan_provinsi: '',
        catatan: '',
      }))
    }

    const ws = XLSX.utils.json_to_sheet(data)

    // Set column widths
    if (mode === 'daerah') {
      ws['!cols'] = [
        { wch: 15 }, { wch: 12 }, { wch: 35 }, { wch: 30 }, { wch: 12 },
        { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
        { wch: 25 },
      ]
    } else {
      ws['!cols'] = [
        { wch: 15 }, { wch: 12 }, { wch: 35 }, { wch: 30 }, { wch: 12 },
        { wch: 18 }, { wch: 25 },
      ]
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, mode === 'daerah' ? 'Acuan Rata-rata Daerah' : 'Acuan Baku Provinsi')

    // Add instruction sheet
    const instructions = [
      { petunjuk: 'CARA PENGISIAN:' },
      { petunjuk: mode === 'daerah'
        ? '1. Isi nama RS pembanding + tarifnya (minimal 3 RS)'
        : '1. Isi tarif_acuan_provinsi (ceiling price dari provinsi)' },
      { petunjuk: mode === 'daerah'
        ? '2. Sistem akan auto-calculate rata-rata dari 3 RS'
        : '2. Tarif ini adalah harga TERTINGGI yang dibayar BPJS' },
      { petunjuk: '3. Jangan ubah kode_item dan nama_item_standar' },
      { petunjuk: '4. nama_item_alias dipakai untuk fuzzy match saat scan tarif' },
      { petunjuk: '5. Bisa tambah baris baru (item kustom) di bawah' },
      { petunjuk: '6. Upload file ini di menu Bank Tarif → Import' },
    ]
    const wsInstr = XLSX.utils.json_to_sheet(instructions)
    wsInstr['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Petunjuk')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = mode === 'daerah'
      ? 'template-tarif-acuan-rata-rata-daerah.xlsx'
      : 'template-tarif-acuan-baku-provinsi.xlsx'

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: any) {
    console.error('Template standar error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
