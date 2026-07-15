import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pipeline_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Get pipeline
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('*')
      .eq('id', data.pipeline_id)
      .single()
    if (pErr || !pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })
    
    // Access control
    if (me.role !== 'super_admin' && pipeline.kantor_cabang_id !== me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
    }
    
    // Get active template for this jenis
    const templateJenis = pipeline.jenis === 'pks_baru' || pipeline.jenis === 'perpanjangan' ? 'pks' : 'adendum_ayat'
    const { data: template } = await supabaseAdmin
      .from('wpa_pks_template')
      .select('*')
      .eq('jenis_dokumen', templateJenis)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (!template) {
      return NextResponse.json({ error: `Template ${templateJenis} belum diupload. Minta Super Admin upload template mandatori.` }, { status: 400 })
    }
    
    // Get placeholders with klasifikasi
    const { data: placeholders } = await supabaseAdmin
      .from('wpa_pks_template_placeholder')
      .select('*')
      .eq('template_id', template.id)
      .order('bab_id', { ascending: true })
      .order('urutan_dalam_bab', { ascending: true })
    
    // Get babs
    const { data: babs } = await supabaseAdmin
      .from('wpa_template_bab')
      .select('*')
      .eq('template_id', template.id)
      .order('urutan', { ascending: true })
    
    // Auto-fill data from DB
    const autoData: Record<string, string> = {}
    
    // Faskes data
    if (pipeline.faskes_id) {
      const { data: faskes } = await supabaseAdmin
        .from('wpa_faskes')
        .select('*')
        .eq('id', pipeline.faskes_id)
        .single()
      if (faskes) {
        autoData['NAMA_FASKES'] = faskes.nama || ''
        autoData['ALAMAT_FASKES'] = faskes.alamat || ''
        autoData['JENIS_FASKES'] = faskes.jenis || ''
        autoData['BENTUK_FASKES'] = faskes.bentuk || ''
        autoData['NPWP'] = faskes.npwp || ''
        autoData['TELP_FASKES'] = faskes.telp || ''
        autoData['EMAIL_FASKES'] = faskes.email || ''
        autoData['NAMA_PENANDATANGAN_PIHAK_KEDUA'] = faskes.penanggung_jawab_nama || ''
        autoData['JABATAN_PENANDATANGAN_PIHAK_KEDUA'] = faskes.penanggung_jawab_jabatan || ''
        autoData['NAMA_BANK'] = faskes.bank_name || ''
        autoData['CABANG_BANK'] = faskes.bank_cabang || ''
        autoData['NOMOR_REKENING'] = faskes.bank_rekening_number || ''
        autoData['NAMA_REKENING'] = faskes.bank_rekening_name || ''
        autoData['NAMA_PJ_FASKES'] = faskes.penanggung_jawab_nama || ''
        autoData['JABATAN_PJ_FASKES'] = faskes.penanggung_jawab_jabatan || ''
      }
    }
    
    // Kantor cabang data
    if (pipeline.kantor_cabang_id) {
      const { data: kantor } = await supabaseAdmin
        .from('wpa_kantor_cabang')
        .select('*')
        .eq('id', pipeline.kantor_cabang_id)
        .single()
      if (kantor) {
        autoData['NAMA_KANTOR_CABANG'] = kantor.nama || ''
        autoData['ALAMAT_KANTOR_CABANG'] = kantor.alamat || ''
        autoData['TELP_FAX_BPJS'] = kantor.telp || ''
        autoData['KOTA_KANTOR_CABANG'] = kantor.kota || ''
        autoData['KOTA_TANDA_TANGAN'] = kantor.kota || ''
      }
    }
    
    // PIC BPJS data (case_manager)
    const { data: cm } = await supabaseAdmin
      .from('wpa_users')
      .select('full_name, phone, email, role')
      .eq('kantor_cabang_id', pipeline.kantor_cabang_id)
      .eq('role', 'case_manager')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (cm) {
      autoData['NAMA_PIC_BPJS'] = cm.full_name || ''
      autoData['HP_PIC_BPJS'] = cm.phone || ''
      autoData['EMAIL_PIC_BPJS'] = cm.email || ''
      autoData['JABATAN_PIC_BPJS'] = 'Case Manager'
    }
    
    // Kepala kantor (kabid)
    const { data: kabid } = await supabaseAdmin
      .from('wpa_users')
      .select('full_name, phone')
      .eq('kantor_cabang_id', pipeline.kantor_cabang_id)
      .eq('role', 'kepala_bidang')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (kabid) {
      autoData['NAMA_KEPALA_KANTOR_CABANG'] = kabid.full_name || ''
    }
    
    // Tanggal hari ini
    const today = new Date()
    autoData['HARI_TANDA_TANGAN'] = today.toLocaleDateString('id-ID', { weekday: 'long' })
    autoData['TANGGAL_TANDA_TANGAN'] = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    
    // Parent PKS data (untuk perpanjangan)
    if (pipeline.jenis === 'perpanjangan' && pipeline.pks_id) {
      const { data: pks } = await supabaseAdmin
        .from('wpa_pks')
        .select('*')
        .eq('id', pipeline.pks_id)
        .single()
      if (pks?.data_jsonb) {
        // Copy data from parent PKS
        for (const [key, value] of Object.entries(pks.data_jsonb)) {
          if (!autoData[key] && value) {
            autoData[key] = String(value)
          }
        }
      }
    }
    
    // Group placeholders by bab
    const placeholderByBab: Record<string, any[]> = {}
    for (const p of placeholders || []) {
      if (!placeholderByBab[p.bab_id]) placeholderByBab[p.bab_id] = []
      placeholderByBab[p.bab_id].push({
        ...p,
        auto_value: autoData[p.key] || null,
      })
    }
    
    return NextResponse.json({
      template,
      babs: babs || [],
      placeholders: placeholders || [],
      placeholder_by_bab: placeholderByBab,
      auto_data: autoData,
      auto_count: Object.keys(autoData).length,
      manual_required: (placeholders || []).filter(p => p.tipe === 'manual_required').length,
      manual_optional: (placeholders || []).filter(p => p.tipe === 'manual_optional').length,
    })
  } catch (e: any) {
    console.error('Drafting start error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
