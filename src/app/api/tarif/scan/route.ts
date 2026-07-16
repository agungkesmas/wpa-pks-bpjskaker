import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { normalizeItemName, fuzzyMatch, classifyTarif } from '@/lib/ai-provider'

// POST /api/tarif/scan?pipeline_id=X
// Pattern scan: parse Excel tarif PIC RS + compare Bank Tarif + compare PKS lama
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const pipelineId = searchParams.get('pipeline_id')
    if (!pipelineId) return NextResponse.json({ error: 'pipeline_id wajib' }, { status: 400 })

    // Get pipeline
    const { data: pipeline } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, jenis, faskes_id, kantor_cabang_id, current_tahap')
      .eq('id', pipelineId)
      .single()
    if (!pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })

    // Access control
    if (me.role !== 'super_admin') {
      if (me.role === 'case_manager' || me.role === 'kepala_bidang') {
        if (pipeline.kantor_cabang_id !== me.kantor_cabang_id) {
          return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Hanya CM/Kabid yang bisa scan tarif' }, { status: 403 })
      }
    }

    // 1. Find tarif Excel yang diupload PIC RS
    const { data: tarifDoc } = await supabaseAdmin
      .from('wpa_pengajuan_dokumen')
      .select('id, file_name, file_url, catatan')
      .eq('pipeline_id', pipelineId)
      .eq('jenis', 'tarif_diajukan')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!tarifDoc) {
      return NextResponse.json({ error: 'File tarif belum diupload oleh PIC RS' }, { status: 400 })
    }

    // 2. Download & parse Excel
    const storagePath = tarifDoc.catatan?.startsWith('storage_path:')
      ? tarifDoc.catatan.replace('storage_path:', '')
      : null

    let excelBuffer: Buffer
    if (storagePath) {
      const { data: fileData, error: dlErr } = await supabaseAdmin
        .storage.from('wpa-pengajuan-docs')
        .download(storagePath)
      if (dlErr || !fileData) throw new Error('Gagal download file tarif')
      excelBuffer = Buffer.from(await fileData.arrayBuffer())
    } else {
      // Fallback: fetch from URL
      const res = await fetch(tarifDoc.file_url)
      excelBuffer = Buffer.from(await res.arrayBuffer())
    }

    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel tarif kosong' }, { status: 400 })
    }

    // 3. Parse rows — flexible column mapping
    const tarifItems = rows.map((raw: any) => {
      const namaItem = String(raw.nama_item || raw.Nama_Item || raw.nama || raw.Nama || raw.item || raw.Item || raw.layanan || raw.Layanan || Object.values(raw)[0] || '').trim()
      const tarif = parseFloat(String(raw.tarif || raw.Tarif || raw.harga || raw.Harga || raw.biaya || raw.Biaya || Object.values(raw)[1] || '0').replace(/[^\d.-]/g, '')) || 0
      const satuan = String(raw.satuan || raw.Satuan || raw.Satuan || '').trim()
      const kategori = String(raw.kategori || raw.Kategori || raw.Kategori || '').trim().toLowerCase().replace(/\s+/g, '_')
      return { nama_item: namaItem, tarif, satuan, kategori }
    }).filter(item => item.nama_item && item.tarif > 0)

    if (tarifItems.length === 0) {
      return NextResponse.json({ error: 'Tidak ada item tarif valid di Excel (butuh kolom nama + tarif)' }, { status: 400 })
    }

    // 4. Query Bank Tarif acuan
    const { data: acuanList } = await supabaseAdmin
      .from('wpa_tarif_acuan')
      .select('id, kategori, nama_item, nama_item_standar, nama_item_alias, tarif_acuan, satuan')
      .eq('kantor_cabang_id', pipeline.kantor_cabang_id)
      .eq('is_active', true)

    // 5. Query tarif PKS lama (untuk perpanjangan)
    let tarifLamaMap: Record<string, number> = {}
    if (pipeline.jenis === 'perpanjangan') {
      const { data: tarifLama } = await supabaseAdmin
        .from('wpa_tarif_faskes')
        .select('nama_item, tarif')
        .eq('faskes_id', pipeline.faskes_id)
        .order('created_at', { ascending: false })
        .limit(100)
      ;(tarifLama || []).forEach((t: any) => {
        tarifLamaMap[normalizeItemName(t.nama_item)] = t.tarif
      })
    }

    // 6. Compare per item
    const results = tarifItems.map(item => {
      // Match ke Bank Tarif acuan (3-layer fuzzy)
      let matchedAcuan: any = null
      for (const acuan of (acuanList || [])) {
        const acuanName = acuan.nama_item_standar || acuan.nama_item
        const aliases = acuan.nama_item_alias || []
        if (fuzzyMatch(item.nama_item, acuanName, aliases)) {
          matchedAcuan = acuan
          break
        }
      }

      // Klasifikasi vs Bank Tarif
      const { status, selisih, selisihPct } = classifyTarif(
        item.tarif,
        matchedAcuan?.tarif_acuan || null
      )

      // Compare vs PKS lama
      const normName = normalizeItemName(item.nama_item)
      const tarifLama = tarifLamaMap[normName]
      let pksLamaStatus: string = 'BARU'
      let pksLamaDelta: number | null = null
      if (tarifLama !== undefined) {
        pksLamaDelta = item.tarif - tarifLama
        pksLamaStatus = pksLamaDelta === 0 ? 'SAMA' : 'BERUBAH'
      }

      return {
        nama_item: item.nama_item,
        tarif_diajukan: item.tarif,
        satuan: item.satuan || matchedAcuan?.satuan || '',
        kategori: item.kategori || matchedAcuan?.kategori || 'lainnya',
        acuan_nama: matchedAcuan?.nama_item_standar || matchedAcuan?.nama_item || null,
        tarif_acuan: matchedAcuan?.tarif_acuan || null,
        selisih,
        selisih_pct: selisihPct,
        status_kewajaran: status,
        pks_lama_status: pksLamaStatus,
        pks_lama_tarif: tarifLama || null,
        pks_lama_delta: pksLamaDelta,
      }
    })

    // 7. Summary
    const summary = {
      total: results.length,
      wajar: results.filter(r => r.status_kewajaran === 'WAJAR').length,
      perlu_review: results.filter(r => r.status_kewajaran === 'PERLU_REVIEW').length,
      tidak_wajar: results.filter(r => r.status_kewajaran === 'TIDAK_WAJAR').length,
      no_acuan: results.filter(r => r.status_kewajaran === 'NO_ACUAN').length,
      sama_pks_lama: results.filter(r => r.pks_lama_status === 'SAMA').length,
      berubah_pks_lama: results.filter(r => r.pks_lama_status === 'BERUBAH').length,
      baru: results.filter(r => r.pks_lama_status === 'BARU').length,
      auto_approve: false,
    }

    // Auto-approve kalau 100% sama dengan PKS lama dan tidak ada yang tidak_wajar
    if (summary.tidak_wajar === 0 && summary.sama_pks_lama === summary.total && summary.total > 0) {
      summary.auto_approve = true
    }

    // 8. Simpan hasil ke pipeline_log
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: pipelineId,
      tahap: pipeline.current_tahap,
      action: 'submit',
      performed_by: me.id,
      catatan: `Scan tarif: ${summary.total} item, ${summary.wajar} wajar, ${summary.perlu_review} review, ${summary.tidak_wajar} tidak wajar, ${summary.no_acuan} no acuan. PKS lama: ${summary.sama_pks_lama} sama, ${summary.berubah_pks_lama} berubah, ${summary.baru} baru.${summary.auto_approve ? ' AUTO-APPROVE (semua sama PKS lama).' : ''}`,
      metadata: { scan_result: { summary, detail: results } },
    })

    return NextResponse.json({
      success: true,
      summary,
      detail: results,
      file_name: tarifDoc.file_name,
      auto_approve: summary.auto_approve,
    })
  } catch (e: any) {
    console.error('Tarif scan error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
