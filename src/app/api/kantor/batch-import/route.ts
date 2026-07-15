import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import * as XLSX from 'xlsx'

// POST /api/kantor/batch-import
// Upload Excel kantor → parse → insert batch
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Hanya Super Admin/Kabid' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

    if (!file.name.match(/\.xlsx$/i)) {
      return NextResponse.json({ error: 'File harus .xlsx' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file melebihi 5MB' }, { status: 400 })
    }

    // Parse Excel
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    }
    if (rows.length > 100) {
      return NextResponse.json({ error: 'Maksimal 100 kantor per import' }, { status: 400 })
    }

    // Validate + normalize rows
    const errors: Array<{ row: number; message: string }> = []
    const validRows: any[] = []
    const kodeSet = new Set<string>()  // untuk cek duplikat di Excel sendiri

    rows.forEach((raw: any, idx) => {
      const rowNum = idx + 2  // +2 karena header di row 1, data mulai row 2
      const kode = String(raw.kode || raw.Kode || raw.KODE || '').trim()
      const nama = String(raw.nama || raw.Nama || raw.NAMA || '').trim()
      const alamat = String(raw.alamat || raw.Alamat || '').trim()
      const kota = String(raw.kota || raw.Kota || '').trim()
      const provinsi = String(raw.provinsi || raw.Provinsi || '').trim()
      const telp = String(raw.telp || raw.Telp || raw.Telp || '').trim()
      const email = String(raw.email || raw.Email || '').trim()

      if (!kode) {
        errors.push({ row: rowNum, message: 'Kode wajib diisi' })
        return
      }
      if (!nama) {
        errors.push({ row: rowNum, message: 'Nama wajib diisi' })
        return
      }
      if (kodeSet.has(kode.toLowerCase())) {
        errors.push({ row: rowNum, message: `Kode "${kode}" duplikat di Excel` })
        return
      }
      kodeSet.add(kode.toLowerCase())

      validRows.push({ kode, nama, alamat: alamat || null, kota: kota || null, provinsi: provinsi || null, telp: telp || null, email: email || null })
    })

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Tidak ada row valid untuk diimport',
        total_processed: rows.length,
        total_success: 0,
        total_error: errors.length,
        errors,
      }, { status: 400 })
    }

    // Cek duplikat kode di DB
    const kodesToCheck = validRows.map(r => r.kode)
    const { data: existingKantor } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .select('kode')
      .in('kode', kodesToCheck)

    const existingKodes = new Set((existingKantor || []).map((k: any) => (k.kode || '').toLowerCase()))
    const rowsToInsert = validRows.filter(r => !existingKodes.has(r.kode.toLowerCase()))
    const duplicateErrors = validRows
      .filter(r => existingKodes.has(r.kode.toLowerCase()))
      .map(r => ({ row: 0, message: `Kode "${r.kode}" sudah ada di DB` }))

    if (rowsToInsert.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Semua kantor sudah ada di DB (duplikat)',
        total_processed: rows.length,
        total_success: 0,
        total_error: errors.length + duplicateErrors.length,
        errors: [...errors, ...duplicateErrors],
      }, { status: 400 })
    }

    // Batch insert
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .insert(rowsToInsert.map(r => ({
        kode: r.kode,
        nama: r.nama,
        alamat: r.alamat,
        kota: r.kota,
        provinsi: r.provinsi,
        telp: r.telp,
        email: r.email,
        is_active: true,
      })))
      .select('id, kode, nama')

    if (insErr) {
      console.error('Batch insert kantor error:', insErr)
      return NextResponse.json({
        success: false,
        message: `Gagal insert: ${insErr.message}`,
        total_processed: rows.length,
        total_success: 0,
        total_error: rows.length,
        errors,
      }, { status: 500 })
    }

    const totalSuccess = (inserted || []).length
    const totalError = errors.length + duplicateErrors.length

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id || undefined,
      action: 'kantor_batch_import',
      entity_type: 'wpa_kantor_cabang',
      after_data: { total_processed: rows.length, total_success: totalSuccess, total_error: totalError },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Berhasil import ${totalSuccess} kantor cabang${totalError > 0 ? `, ${totalError} error` : ''}`,
      total_processed: rows.length,
      total_success: totalSuccess,
      total_error: totalError,
      errors: [...errors, ...duplicateErrors],
      created_ids: (inserted || []).map((k: any) => k.id),
    })
  } catch (e: any) {
    console.error('Batch import kantor error:', e)
    return NextResponse.json({
      success: false,
      message: e.message,
      total_processed: 0,
      total_success: 0,
      total_error: 1,
      errors: [{ row: 0, message: e.message }],
    }, { status: 500 })
  }
}
