import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { normalizeItemName, fuzzyMatch } from '@/lib/ai-provider'

// POST /api/tarif/konversi
// Tools konversi tarif asal (format ngacak) → format standar Bank Tarif
// Body: { file: FormData, kantor_cabang_id, tahun }
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'case_manager' && me.role !== 'kepala_bidang' && me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya CM/Kabid' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const kantorCabangId = formData.get('kantor_cabang_id') as string
    const tahun = parseInt(formData.get('tahun') as string) || new Date().getFullYear()

    if (!file) return NextResponse.json({ error: 'File wajib' }, { status: 400 })
    if (!kantorCabangId) return NextResponse.json({ error: 'kantor_cabang_id wajib' }, { status: 400 })

    // Parse Excel
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    }

    // Auto-detect columns (flexible)
    const firstRow = rows[0] as any
    const keys = Object.keys(firstRow)

    // Cari kolom nama dan tarif
    let namaKey = keys.find(k => /nama|item|layanan|deskripsi/i.test(k)) || keys[0]
    let tarifKey = keys.find(k => /tarif|harga|biaya|nilai/i.test(k)) || keys[1]
    let satuanKey = keys.find(k => /satuan|unit/i.test(k)) || ''
    let kategoriKey = keys.find(k => /kategori|group|jenis/i.test(k)) || ''

    // Parse items
    const items = rows.map((raw: any) => {
      const namaItem = String(raw[namaKey] || '').trim()
      const tarif = parseFloat(String(raw[tarifKey] || '0').replace(/[^\d.-]/g, '')) || 0
      const satuan = satuanKey ? String(raw[satuanKey] || '').trim() : ''
      const kategori = kategoriKey ? String(raw[kategoriKey] || '').trim().toLowerCase().replace(/\s+/g, '_') : 'lainnya'
      return { nama_item: namaItem, tarif_acuan: tarif, satuan, kategori }
    }).filter(item => item.nama_item && item.tarif_acuan > 0)

    // Query existing standar items untuk fuzzy match
    const { data: existingAcuan } = await supabaseAdmin
      .from('wpa_tarif_acuan')
      .select('id, kategori, nama_item, nama_item_standar, nama_item_alias, tarif_acuan')
      .eq('kantor_cabang_id', kantorCabangId)
      .eq('is_active', true)

    // Auto-match each item ke standar
    const matched = items.map(item => {
      let bestMatch: any = null
      let matchConfidence: 'exact' | 'fuzzy' | 'none' = 'none'

      for (const acuan of (existingAcuan || [])) {
        const acuanName = acuan.nama_item_standar || acuan.nama_item
        const aliases = acuan.nama_item_alias || []

        if (normalizeItemName(item.nama_item) === normalizeItemName(acuanName)) {
          bestMatch = acuan
          matchConfidence = 'exact'
          break
        }
        if (fuzzyMatch(item.nama_item, acuanName, aliases)) {
          bestMatch = acuan
          matchConfidence = 'fuzzy'
        }
      }

      return {
        ...item,
        matched_standar: bestMatch?.nama_item_standar || bestMatch?.nama_item || null,
        matched_id: bestMatch?.id || null,
        match_confidence: matchConfidence,
        existing_tarif: bestMatch?.tarif_acuan || null,
        will_update: bestMatch ? true : false,
      }
    })

    return NextResponse.json({
      success: true,
      total: matched.length,
      matched_exact: matched.filter(m => m.match_confidence === 'exact').length,
      matched_fuzzy: matched.filter(m => m.match_confidence === 'fuzzy').length,
      no_match: matched.filter(m => m.match_confidence === 'none').length,
      items: matched,
      detected_columns: { nama: namaKey, tarif: tarifKey, satuan: satuanKey, kategori: kategoriKey },
    })
  } catch (e: any) {
    console.error('Konversi error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
