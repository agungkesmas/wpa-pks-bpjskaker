import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import * as XLSX from 'xlsx'

const VALID_KATEGORI = ['kamar','operasi_kecil','operasi_sedang','operasi_besar','laboratorium','radiologi','tindakan_medis','rawat_inap','obat','admin','lainnya']

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['admin_kantor','case_manager','pic_rs','legal_rs'].includes(me.role)) {
      return NextResponse.json({ error: 'Role tidak diizinkan upload tarif' }, { status: 403 })
    }
    if (!me.faskes_id && me.role !== 'admin_kantor' && me.role !== 'case_manager') {
      return NextResponse.json({ error: 'Akun tidak terasosiasi ke faskes manapun' }, { status: 400 })
    }
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    const faskes_id_form = formData.get('faskes_id') as string
    const tahun_form = formData.get('tahun') as string
    
    if (!file) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }
    
    const faskes_id = faskes_id_form || me.faskes_id
    if (!faskes_id) {
      return NextResponse.json({ error: 'faskes_id wajib' }, { status: 400 })
    }
    
    const tahun = parseInt(tahun_form) || new Date().getFullYear()
    
    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      return NextResponse.json({ 
        error: 'Format file harus .xlsx, .xls, atau .csv. Download template dari menu Bank Tarif.' 
      }, { status: 400 })
    }
    
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    
    // Find the tarif sheet (skip 'Instruksi' if exists)
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('tarif')) || wb.SheetNames[wb.SheetNames.length - 1]
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Sheet kosong atau tidak ada data' }, { status: 400 })
    }
    
    // Get faskes & kantor cabang
    const { data: faskes, error: faskesErr } = await supabaseAdmin
      .from('wpa_faskes')
      .select('id, nama, kantor_cabang_id')
      .eq('id', faskes_id)
      .single()
    if (faskesErr || !faskes) {
      return NextResponse.json({ error: 'Faskes tidak ditemukan' }, { status: 404 })
    }
    
    // Create upload batch
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from('wpa_tarif_upload_batch')
      .insert({
        faskes_id,
        kantor_cabang_id: faskes.kantor_cabang_id,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: me.id,
        status: 'processing',
      })
      .select()
      .single()
    if (batchErr) throw batchErr
    
    // Parse & validate rows
    const parsedItems: any[] = []
    const errors: string[] = []
    
    rows.forEach((row: any, idx: number) => {
      const kategori = (row.kategori || row.Kategori || '').toString().trim().toLowerCase()
      const nama_item = (row.nama_item || row.Nama_Item || row['Nama Item'] || row.item || '').toString().trim()
      const satuan = (row.satuan || row.Satuan || '').toString().trim() || null
      const tarifRaw = row.tarif || row.Tarif || row.harga || row.Harga
      const tarif = typeof tarifRaw === 'number' ? tarifRaw : parseFloat((tarifRaw || '').toString().replace(/[^\d.-]/g, ''))
      
      if (!kategori || !nama_item || !tarif || tarif <= 0) {
        errors.push(`Baris ${idx + 2}: data tidak lengkap (kategori="${kategori}", nama="${nama_item}", tarif="${tarifRaw}")`)
        return
      }
      
      if (!VALID_KATEGORI.includes(kategori)) {
        errors.push(`Baris ${idx + 2}: kategori "${kategori}" tidak valid. Valid: ${VALID_KATEGORI.join(', ')}`)
        return
      }
      
      parsedItems.push({
        faskes_id,
        kantor_cabang_id: faskes.kantor_cabang_id,
        upload_batch_id: batch.id,
        kategori,
        nama_item,
        satuan,
        tarif: Math.round(tarif * 100) / 100,
        tahun,
        uploaded_by: me.id,
      })
    })
    
    if (parsedItems.length === 0) {
      // Update batch to failed
      await supabaseAdmin
        .from('wpa_tarif_upload_batch')
        .update({ 
          status: 'failed', 
          error_log: errors.join('\n'),
          item_count: 0,
        })
        .eq('id', batch.id)
      
      return NextResponse.json({ 
        error: 'Tidak ada baris valid. Periksa format file.',
        details: errors.slice(0, 10),
      }, { status: 400 })
    }
    
    // For each item, lookup acuan & calc kewajaran
    const kantorCabangId = faskes.kantor_cabang_id
    let comparedCount = 0
    let noAcuanCount = 0
    
    for (const item of parsedItems) {
      const { data: acuan } = await supabaseAdmin
        .from('wpa_tarif_acuan')
        .select('id, tarif_acuan, tarif_std_dev, sample_count')
        .eq('kantor_cabang_id', kantorCabangId)
        .eq('kategori', item.kategori)
        .eq('nama_item', item.nama_item)
        .eq('tahun', item.tahun)
        .eq('is_active', true)
        .maybeSingle()
      
      if (acuan && acuan.tarif_acuan) {
        // Call RPC function to calc kewajaran
        const { data: kewajaran, error: kErr } = await supabaseAdmin
          .rpc('wpa_calc_kewajaran', {
            p_tarif: item.tarif,
            p_acuan: acuan.tarif_acuan,
            p_std_dev: acuan.tarif_std_dev || null,
          })
        
        if (!kErr && kewajaran && kewajaran.length > 0) {
          const k = kewajaran[0]
          item.tarif_acuan_id = acuan.id
          item.tarif_acuan = acuan.tarif_acuan
          item.selisih = k.selisih
          item.selisih_percent = k.selisih_percent
          item.z_score = k.z_score
          item.status_kewajaran = k.status
          comparedCount++
        } else {
          item.status_kewajaran = 'no_acuan'
          noAcuanCount++
        }
      } else {
        item.status_kewajaran = 'no_acuan'
        noAcuanCount++
      }
    }
    
    // Delete existing faskes tarif for same faskes+tahun (replace), then insert new
    await supabaseAdmin
      .from('wpa_tarif_faskes')
      .delete()
      .eq('faskes_id', faskes_id)
      .eq('tahun', tahun)
    
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('wpa_tarif_faskes')
      .insert(parsedItems)
      .select()
    
    if (insertErr) throw insertErr
    
    // Update batch
    await supabaseAdmin
      .from('wpa_tarif_upload_batch')
      .update({
        status: 'processed',
        item_count: parsedItems.length,
        item_compared: comparedCount,
        item_no_acuan: noAcuanCount,
        error_log: errors.length > 0 ? errors.join('\n') : null,
      })
      .eq('id', batch.id)
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: kantorCabangId,
      action: 'upload_tarif_faskes',
      entity_type: 'tarif_faskes',
      entity_id: batch.id,
      after_data: { 
        faskes_id, 
        file_name: file.name, 
        item_count: parsedItems.length,
        compared: comparedCount,
        no_acuan: noAcuanCount,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({
      success: true,
      batch_id: batch.id,
      summary: {
        total_items: parsedItems.length,
        compared: comparedCount,
        no_acuan: noAcuanCount,
        errors: errors.length,
        error_details: errors.slice(0, 5),
      }
    })
  } catch (e: any) {
    console.error('Upload tarif error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
