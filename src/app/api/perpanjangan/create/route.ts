import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pks_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  catatan: z.string().optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['pic_rs', 'case_manager', 'super_admin'].includes(me.role)) {
      return NextResponse.json({ error: 'Hanya PIC RS atau CM yang bisa ajukan perpanjangan' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Get PKS lama
    const { data: pksLama, error: pksErr } = await supabaseAdmin
      .from('wpa_pks')
      .select('*')
      .eq('id', data.pks_id)
      .single()
    if (pksErr || !pksLama) return NextResponse.json({ error: 'PKS tidak ditemukan' }, { status: 404 })
    
    // Verify PKS is ditandatangani
    if (pksLama.status !== 'ditandatangani') {
      return NextResponse.json({ error: 'PKS belum ditandatangani, tidak bisa diperpanjang' }, { status: 400 })
    }
    
    // Check PIC RS has access to this faskes
    if (me.role === 'pic_rs' && pksLama.faskes_id !== me.faskes_id) {
      return NextResponse.json({ error: 'Anda tidak punya akses ke PKS ini' }, { status: 403 })
    }
    
    // Check if there's already an active perpanjangan pipeline for this PKS
    const { data: existingPipeline } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, status')
      .eq('pks_id', data.pks_id)
      .eq('jenis', 'perpanjangan')
      .eq('status', 'in_progress')
      .maybeSingle()
    if (existingPipeline) {
      return NextResponse.json({ error: 'Perpanjangan untuk PKS ini sudah dalam proses' }, { status: 400 })
    }
    
    // Calculate new dates (mulai = berakhir lama, berakhir = +3 tahun default)
    const tanggalMulaiBaru = pksLama.tanggal_berakhir
    const berakhirDate = new Date(pksLama.tanggal_berakhir)
    berakhirDate.setFullYear(berakhirDate.getFullYear() + 3)
    const tanggalBerakhirBaru = berakhirDate.toISOString().split('T')[0]
    
    // Create pipeline
    const { data: pipeline, error: pipelineErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .insert({
        jenis: 'perpanjangan',
        reference_id: data.pks_id,
        reference_type: 'pks',
        kantor_cabang_id: pksLama.kantor_cabang_id,
        faskes_id: pksLama.faskes_id,
        pks_id: data.pks_id,
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
    
    // Log
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: pipeline.id,
      tahap: 'diajukan',
      action: 'enter',
      performed_by: me.id,
      catatan: data.catatan || `Perpanjangan PKS ${pksLama.kode_pks_pihak_pertama} diajukan. Auto-clone data dari PKS lama.`,
    })
    
    // Auto-clone: copy data_jsonb from PKS lama ke pipeline metadata
    // (akan dipakai saat drafting untuk pre-fill)
    
    // Notify CM + Kabid
    const { data: recipients } = await supabaseAdmin
      .from('wpa_users')
      .select('id, role')
      .eq('kantor_cabang_id', pksLama.kantor_cabang_id)
      .in('role', ['case_manager', 'kepala_bidang'])
      .eq('is_active', true)
    if (recipients && recipients.length > 0) {
      await supabaseAdmin.from('wpa_notifications').insert(
        recipients.map(r => ({
          user_id: r.id,
          kantor_cabang_id: pksLama.kantor_cabang_id,
          type: 'perpanjangan_baru',
          title: 'Pengajuan Perpanjangan PKS',
          body: `${me.full_name} mengajukan perpanjangan PKS ${pksLama.kode_pks_pihak_pertama}. Mohon ditinjau.`,
          related_entity: 'pipeline',
          related_id: pipeline.id,
        }))
      )
    }
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pksLama.kantor_cabang_id,
      action: 'create_perpanjangan',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      after_data: { pks_lama_id: data.pks_id, kode_pks: pksLama.kode_pks_pihak_pertama },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({
      success: true,
      pipeline_id: pipeline.id,
      message: 'Pengajuan perpanjangan berhasil dikirim. Data dari PKS lama akan di-clone saat drafting.',
    })
  } catch (e: any) {
    console.error('Perpanjangan create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
