import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  kantor_cabang_id: z.string().uuid().optional(),
  kategori: z.enum(['kamar','operasi_kecil','operasi_sedang','operasi_besar','laboratorium','radiologi','tindakan_medis','rawat_inap','obat','admin','lainnya']),
  nama_item: z.string().min(1),
  satuan: z.string().optional(),
  tahun: z.number().int().min(2020).max(2100).optional(),
  
  // Mode input:
  // - 'manual': tarif_acuan diisi langsung, sample_data kosong
  // - 'calculation': sample_data berisi array [{rs_nama, tarif}], sistem hitung statistik
  sumber: z.enum(['manual','calculation']).default('manual'),
  tarif_acuan: z.number().positive().optional(),  // wajib jika sumber='manual'
  sample_data: z.array(z.object({
    rs_nama: z.string(),
    tarif: z.number().positive()
  })).optional(),  // wajib jika sumber='calculation'
  
  catatan: z.string().optional(),
})

function calcStats(samples: { rs_nama: string; tarif: number }[]) {
  if (!samples || samples.length === 0) {
    return { tarif_acuan: 0, tarif_min: null, tarif_max: null, tarif_mean: 0, tarif_median: 0, tarif_std_dev: 0, sample_count: 0 }
  }
  const tarifs = samples.map(s => s.tarif).sort((a, b) => a - b)
  const n = tarifs.length
  const sum = tarifs.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const median = n % 2 === 0 ? (tarifs[n/2 - 1] + tarifs[n/2]) / 2 : tarifs[Math.floor(n/2)]
  const variance = n > 1 ? tarifs.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / (n - 1) : 0
  const std_dev = Math.sqrt(variance)
  return {
    tarif_acuan: Math.round(mean),
    tarif_min: tarifs[0],
    tarif_max: tarifs[n - 1],
    tarif_mean: Math.round(mean),
    tarif_median: Math.round(median),
    tarif_std_dev: Math.round(std_dev * 100) / 100,
    sample_count: n,
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['super_admin','case_manager','kepala_bidang'].includes(me.role)) {
      return NextResponse.json({ error: 'Hanya BPJS staff yang bisa input acuan' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    const kantor_cabang_id = data.kantor_cabang_id || me.kantor_cabang_id
    if (!kantor_cabang_id) {
      return NextResponse.json({ error: 'kantor_cabang_id wajib' }, { status: 400 })
    }
    
    const tahun = data.tahun || new Date().getFullYear()
    
    let insertData: any = {
      kantor_cabang_id,
      kategori: data.kategori,
      nama_item: data.nama_item,
      satuan: data.satuan || null,
      tahun,
      sumber: data.sumber,
      catatan: data.catatan || null,
      created_by: me.id,
      is_active: true,
    }
    
    if (data.sumber === 'manual') {
      if (!data.tarif_acuan) {
        return NextResponse.json({ error: 'tarif_acuan wajib untuk sumber=manual' }, { status: 400 })
      }
      insertData.tarif_acuan = data.tarif_acuan
      insertData.sample_data = []
      insertData.sample_count = 0
    } else {
      // calculation
      if (!data.sample_data || data.sample_data.length === 0) {
        return NextResponse.json({ error: 'sample_data wajib untuk sumber=calculation' }, { status: 400 })
      }
      const stats = calcStats(data.sample_data)
      insertData = { ...insertData, ...stats, sample_data: data.sample_data }
    }
    
    // Upsert (kalau item sama sudah ada, update)
    const { data: result, error } = await supabaseAdmin
      .from('wpa_tarif_acuan')
      .upsert(insertData, { 
        onConflict: 'kantor_cabang_id,kategori,nama_item,tahun',
        ignoreDuplicates: false 
      })
      .select()
      .single()
    
    if (error) throw error
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id,
      action: 'create_tarif_acuan',
      entity_type: 'tarif_acuan',
      entity_id: result.id,
      after_data: result,
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    console.error('Create acuan error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
