import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import * as XLSX from 'xlsx'

// POST /api/tarif/batch-import?mode=provinsi|daerah
// Upload batch tarif acuan
// mode=provinsi: kolom tarif_acuan_provinsi (ceiling manual)
// mode=daerah: kolom RS_1/RS_2/RS_3 (auto-calc rata-rata)
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'case_manager' && me.role !== 'kepala_bidang' && me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya CM/Kabid' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') || 'provinsi'
    const tahun = parseInt(searchParams.get('tahun') || '') || new Date().getFullYear()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File wajib' }, { status: 400 })
    if (!file.name.match(/\.xlsx$/i)) return NextResponse.json({ error: 'File harus .xlsx' }, { status: 400 })

    // Parse Excel
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })

    const errors: Array<{ row: number; message: string }> = []
    const validRows: any[] = []

    rows.forEach((raw: any, idx) => {
      const rowNum = idx + 2
      const kategori = String(raw.kategori || '').trim().toLowerCase().replace(/\s+/g, '_')
      const kodeItem = String(raw.kode_item || '').trim()
      const namaItemStandar = String(raw.nama_item_standar || '').trim()
      const namaItemAliasStr = String(raw.nama_item_alias || '').trim()
      const satuan = String(raw.satuan || '').trim()
      const catatan = String(raw.catatan || '').trim()

      if (!namaItemStandar) {
        errors.push({ row: rowNum, message: 'nama_item_standar wajib diisi' })
        return
      }

      const aliases = namaItemAliasStr ? namaItemAliasStr.split(',').map((s: string) => s.trim()).filter(Boolean) : []

      if (mode === 'daerah') {
        // Mode rata-rata daerah: parse RS_1/RS_2/RS_3
        const samples: Array<{ rs_nama: string; tarif: number }> = []
        for (let i = 1; i <= 5; i++) {  // support up to 5 RS
          const rsNama = String(raw[`RS_${i}_nama`] || '').trim()
          const rsTarif = parseFloat(String(raw[`RS_${i}_tarif`] || '0').replace(/[^\d.-]/g, '')) || 0
          if (rsNama && rsTarif > 0) {
            samples.push({ rs_nama: rsNama, tarif: rsTarif })
          }
        }

        if (samples.length < 2) {
          errors.push({ row: rowNum, message: `Minimal 2 RS pembanding untuk mode rata-rata daerah (ditemukan ${samples.length})` })
          return
        }

        const tarifs = samples.map(s => s.tarif)
        const avg = tarifs.reduce((a, b) => a + b, 0) / tarifs.length
        const min = Math.min(...tarifs)
        const max = Math.max(...tarifs)

        validRows.push({
          kategori: kategori || 'lainnya',
          kode_item: kodeItem || null,
          nama_item: namaItemStandar,
          nama_item_standar: namaItemStandar,
          nama_item_alias: aliases,
          satuan: satuan || null,
          tarif_acuan: Math.round(avg),
          tarif_min: min,
          tarif_max: max,
          tarif_mean: Math.round(avg),
          sample_count: samples.length,
          sample_data: samples,
          tahun,
          sumber: 'calculation',
          catatan: catatan || `Rata-rata dari ${samples.length} RS`,
          is_active: true,
          kantor_cabang_id: me.kantor_cabang_id,
          created_by: me.id,
        })
      } else {
        // Mode provinsi: ceiling price
        const tarifProvinsi = parseFloat(String(raw.tarif_acuan_provinsi || '0').replace(/[^\d.-]/g, '')) || 0
        if (tarifProvinsi <= 0) {
          errors.push({ row: rowNum, message: 'tarif_acuan_provinsi wajib diisi (> 0)' })
          return
        }

        validRows.push({
          kategori: kategori || 'lainnya',
          kode_item: kodeItem || null,
          nama_item: namaItemStandar,
          nama_item_standar: namaItemStandar,
          nama_item_alias: aliases,
          satuan: satuan || null,
          tarif_acuan: tarifProvinsi,
          tarif_acuan_provinsi: tarifProvinsi,
          tarif_min: null,
          tarif_max: null,
          tarif_mean: null,
          sample_count: 0,
          sample_data: [],
          tahun,
          sumber: 'manual',
          catatan: catatan || 'Acuan baku provinsi (ceiling)',
          is_active: true,
          kantor_cabang_id: me.kantor_cabang_id,
          created_by: me.id,
        })
      }
    })

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Tidak ada row valid',
        total_processed: rows.length,
        total_success: 0,
        total_error: errors.length,
        errors,
      }, { status: 400 })
    }

    // Batch upsert (update kalau kode_item sama, insert kalau baru)
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('wpa_tarif_acuan')
      .upsert(validRows, {
        onConflict: 'kantor_cabang_id,kategori,nama_item,tahun',
      })
      .select('id, nama_item_standar, tarif_acuan')

    if (insErr) {
      console.error('Batch insert error:', insErr)
      // Try insert without upsert (conflict = skip)
      const { data: inserted2, error: insErr2 } = await supabaseAdmin
        .from('wpa_tarif_acuan')
        .insert(validRows)
        .select('id, nama_item_standar, tarif_acuan')
      if (insErr2) throw insErr2
      return NextResponse.json({
        success: true,
        message: `Berhasil import ${inserted2?.length || 0} item tarif acuan${errors.length > 0 ? `, ${errors.length} error` : ''}`,
        total_processed: rows.length,
        total_success: inserted2?.length || 0,
        total_error: errors.length,
        errors,
      })
    }

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id,
      action: 'tarif_acuan_batch_import',
      entity_type: 'wpa_tarif_acuan',
      after_data: { mode, total: rows.length, success: inserted?.length || 0, errors: errors.length },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Berhasil import ${inserted?.length || 0} item tarif acuan (${mode === 'daerah' ? 'rata-rata daerah' : 'baku provinsi'})${errors.length > 0 ? `, ${errors.length} error` : ''}`,
      total_processed: rows.length,
      total_success: inserted?.length || 0,
      total_error: errors.length,
      errors,
    })
  } catch (e: any) {
    console.error('Batch import tarif error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
