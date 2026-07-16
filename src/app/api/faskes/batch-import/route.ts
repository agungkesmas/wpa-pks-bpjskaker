import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit, hashPassword } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { randomBytes } from 'crypto'
import { PKS_PLACEHOLDERS } from '@/lib/pks-placeholders'

const VALID_JENIS = ['RS', 'Klinik', 'Puskesmas', 'PraktikMandiri', 'Lainnya']

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#$%'
  const bytes = randomBytes(length)
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += chars[bytes[i] % chars.length]
  return pwd
}

// POST /api/faskes/batch-import
// Upload Excel → create/update faskes + PKS (dengan data_jsonb 81 placeholder) + PIC RS
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'case_manager' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Hanya CM/Kabid' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File wajib' }, { status: 400 })
    if (!file.name.match(/\.xlsx$/i)) return NextResponse.json({ error: 'File harus .xlsx' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })

    if (rows.length === 0) return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })

    const errors: Array<{ row: number; message: string }> = []
    const results: Array<{ row: number; faskes: string; status: string }> = []
    let totalCreated = 0, totalUpdated = 0

    // Build set of placeholder keys for fast lookup
    const placeholderKeys = new Set(PKS_PLACEHOLDERS.map(p => p.key))

    for (let idx = 0; idx < rows.length; idx++) {
      const raw = rows[idx] as any
      const rowNum = idx + 2

      // Base columns
      const namaFaskes = String(raw.nama_faskes || '').trim()
      const jenisFaskes = String(raw.jenis_faskes || '').trim()
      const tipeFaskes = String(raw.tipe_faskes || 'Umum').trim()
      const kota = String(raw.kota || '').trim()
      const provinsi = String(raw.provinsi || '').trim()
      const kodePks = String(raw.kode_pks || '').trim()
      const tglMulai = String(raw.tanggal_mulai_pks || '').trim()
      const tglBerakhir = String(raw.tanggal_berakhir_pks || '').trim()

      if (!namaFaskes) { errors.push({ row: rowNum, message: 'nama_faskes wajib' }); continue }
      if (!kodePks) { errors.push({ row: rowNum, message: 'kode_pks wajib' }); continue }
      if (!tglMulai || !tglBerakhir) { errors.push({ row: rowNum, message: 'tanggal_mulai_pks & tanggal_berakhir_pks wajib' }); continue }

      // Extract 81 placeholder values from row → build data_jsonb
      const dataJsonb: Record<string, any> = {}
      for (const key of Object.keys(raw)) {
        if (placeholderKeys.has(key)) {
          const val = String(raw[key] || '').trim()
          if (val) dataJsonb[key] = val
        }
      }

      // Also extract faskes data from placeholders (fallback if base columns empty)
      const faskesNama = namaFaskes || dataJsonb['NAMA_FASKES'] || ''
      const faskesAlamat = dataJsonb['ALAMAT_FASKES'] || ''
      const faskesJenis = jenisFaskes || (dataJsonb['JENIS_FASKES'] || '').includes('Rumah Sakit') ? 'RS' : 'Klinik'
      const faskesKota = kota || dataJsonb['KOTA_TANDA_TANGAN'] || ''
      const pjNama = dataJsonb['NAMA_PENANDATANGAN_PIHAK_KEDUA'] || dataJsonb['NAMA_PIMPINAN_FASKES'] || ''
      const pjJabatan = dataJsonb['JABATAN_PENANDATANGAN_PIHAK_KEDUA'] || dataJsonb['JABATAN_PIMPINAN_FASKES'] || ''
      const bankName = dataJsonb['NAMA_BANK'] || ''
      const bankCabang = dataJsonb['CABANG_BANK'] || ''
      const bankRekNum = dataJsonb['NOMOR_REKENING'] || ''
      const bankRekName = dataJsonb['NAMA_REKENING'] || ''

      // === STEP 1: FASKES ===
      const { data: existingFaskes } = await supabaseAdmin
        .from('wpa_faskes')
        .select('id')
        .eq('nama', faskesNama)
        .eq('kantor_cabang_id', me.kantor_cabang_id)
        .maybeSingle()

      let faskesId: string
      let status: 'created' | 'updated'

      const faskesData = {
        nama: faskesNama,
        jenis: (faskesJenis || 'Klinik') as any,
        tipe: tipeFaskes,
        alamat: faskesAlamat || null,
        kota: faskesKota || null,
        provinsi: provinsi || null,
        penanggung_jawab_nama: pjNama || null,
        penanggung_jawab_jabatan: pjJabatan || null,
        bank_name: bankName || null,
        bank_cabang: bankCabang || null,
        bank_rekening_number: bankRekNum || null,
        bank_rekening_name: bankRekName || null,
        status: 'aktif',
        kantor_cabang_id: me.kantor_cabang_id,
        updated_at: new Date().toISOString(),
      }

      if (existingFaskes) {
        const { error: updErr } = await supabaseAdmin.from('wpa_faskes').update(faskesData).eq('id', existingFaskes.id)
        if (updErr) { errors.push({ row: rowNum, message: `Gagal update faskes: ${updErr.message}` }); continue }
        faskesId = existingFaskes.id
        status = 'updated'
        totalUpdated++
      } else {
        const { data: newFaskes, error: insErr } = await supabaseAdmin.from('wpa_faskes').insert(faskesData).select('id').single()
        if (insErr) { errors.push({ row: rowNum, message: `Gagal create faskes: ${insErr.message}` }); continue }
        faskesId = newFaskes.id
        status = 'created'
        totalCreated++
      }

      // === STEP 2: PKS (dengan data_jsonb 81 placeholder) ===
      const { data: existingPks } = await supabaseAdmin
        .from('wpa_pks')
        .select('id')
        .eq('kode_pks_pihak_pertama', kodePks)
        .maybeSingle()

      const pksData = {
        kode_pks_pihak_pertama: kodePks,
        faskes_id: faskesId,
        kantor_cabang_id: me.kantor_cabang_id,
        jenis: 'pks_baru',
        status: 'ditandatangani',
        tanggal_mulai: tglMulai,
        tanggal_berakhir: tglBerakhir,
        data_jsonb: dataJsonb,  // 81 placeholder values
        updated_at: new Date().toISOString(),
      }

      if (existingPks) {
        await supabaseAdmin.from('wpa_pks').update(pksData).eq('id', existingPks.id)
      } else {
        await supabaseAdmin.from('wpa_pks').insert({ ...pksData, created_by: me.id })
      }

      results.push({ row: rowNum, faskes: faskesNama, status: `${status} + PKS ${existingPks ? 'updated' : 'created'} (${Object.keys(dataJsonb).length} placeholder)` })
    }

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id,
      action: 'faskes_batch_import_81',
      entity_type: 'wpa_faskes',
      after_data: { total: rows.length, created: totalCreated, updated: totalUpdated, errors: errors.length },
    })

    return NextResponse.json({
      success: true,
      message: `Migrasi selesai: ${totalCreated} faskes baru, ${totalUpdated} updated. ${errors.length} error.`,
      total_processed: rows.length,
      total_success: results.length,
      total_error: errors.length,
      stats: { totalCreated, totalUpdated },
      results,
      errors,
    })
  } catch (e: any) {
    console.error('Batch import faskes error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
