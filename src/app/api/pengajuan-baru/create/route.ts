import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  nama_faskes: z.string().min(3),
  jenis_faskes: z.enum(['RS','Klinik','Puskesmas','PraktikMandiri','Lainnya']),
  tipe_faskes: z.enum(['A','B','C','D','Umum']).default('Umum'),
  alamat: z.string().min(5),
  kota: z.string().min(2),
  provinsi: z.string().min(2),
  telp: z.string().min(5),
  email_faskes: z.string().email().optional().or(z.literal('')),
  npwp: z.string().optional().or(z.literal('')),
  group_id: z.string().optional().or(z.literal('')),
  pj_nama: z.string().min(2),
  pj_jabatan: z.string().min(2),
  pj_phone: z.string().min(5),
  bank_name: z.string().optional().or(z.literal('')),
  bank_cabang: z.string().optional().or(z.literal('')),
  bank_rekening_number: z.string().optional().or(z.literal('')),
  bank_rekening_name: z.string().optional().or(z.literal('')),
  catatan: z.string().optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'pic_rs') {
      return NextResponse.json({ error: 'Hanya PIC RS yang bisa ajukan PKS baru' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    const targetKantorCabangId = '00000000-0000-0000-0000-000000000001'
    
    // 1. Create faskes (status: pengajuan)
    const { data: faskes, error: faskesErr } = await supabaseAdmin
      .from('wpa_faskes')
      .insert({
        nama: data.nama_faskes,
        jenis: data.jenis_faskes,
        tipe: data.tipe_faskes,
        alamat: data.alamat,
        kota: data.kota,
        provinsi: data.provinsi,
        telp: data.telp,
        email: data.email_faskes || null,
        npwp: data.npwp || null,
        penanggung_jawab_nama: data.pj_nama,
        penanggung_jawab_jabatan: data.pj_jabatan,
        penanggung_jawab_phone: data.pj_phone,
        bank_name: data.bank_name || null,
        bank_cabang: data.bank_cabang || null,
        bank_rekening_number: data.bank_rekening_number || null,
        bank_rekening_name: data.bank_rekening_name || null,
        group_id: data.group_id || null,
        status: 'pengajuan',
        kantor_cabang_id: targetKantorCabangId,
      })
      .select()
      .single()
    if (faskesErr) throw faskesErr
    
    // 2. Link PIC RS to faskes
    await supabaseAdmin
      .from('wpa_user_faskes')
      .upsert({ user_id: me.id, faskes_id: faskes.id, is_primary: true })
    await supabaseAdmin
      .from('wpa_users')
      .update({ faskes_id: faskes.id, is_temporary: false })
      .eq('id', me.id)
    
    // 3. Create pipeline
    const { data: pipeline, error: pipelineErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .insert({
        jenis: 'pks_baru',
        reference_id: faskes.id,
        reference_type: 'faskes',
        kantor_cabang_id: targetKantorCabangId,
        faskes_id: faskes.id,
        current_tahap: 'diajukan',
        current_handler_id: null,
        handler_since: null,
        cabang_owned: true,
        sla_deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'in_progress',
        initiated_by: me.id,
      })
      .select()
      .single()
    if (pipelineErr) throw pipelineErr
    
    // 4. Log
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: pipeline.id,
      tahap: 'diajukan',
      action: 'enter',
      performed_by: me.id,
      catatan: data.catatan || 'PIC RS submit pengajuan PKS baru',
    })
    
    // 5. Notifikasi ke CM & Kabid di kantor tujuan
    const { data: recipients } = await supabaseAdmin
      .from('wpa_users')
      .select('id, role')
      .eq('kantor_cabang_id', targetKantorCabangId)
      .in('role', ['case_manager', 'kepala_bidang'])
      .eq('is_active', true)
    if (recipients && recipients.length > 0) {
      await supabaseAdmin.from('wpa_notifications').insert(
        recipients.map(r => ({
          user_id: r.id,
          kantor_cabang_id: targetKantorCabangId,
          type: 'pengajuan_baru',
          title: 'Pengajuan PKS Baru Masuk',
          body: `Pengajuan dari ${me.full_name} untuk faskes ${data.nama_faskes}. Mohon ditinjau.`,
          related_entity: 'pipeline',
          related_id: pipeline.id,
        }))
      )
    }
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: targetKantorCabangId,
      action: 'create_pengajuan_pks_baru',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      after_data: { faskes_id: faskes.id, faskes_nama: data.nama_faskes },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true, 
      pipeline_id: pipeline.id,
      faskes_id: faskes.id,
    })
  } catch (e: any) {
    console.error('Pengajuan create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
