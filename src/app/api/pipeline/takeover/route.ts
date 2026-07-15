import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pipeline_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  reason: z.string().optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Only CM, PP, Kabid can take over
    if (!['case_manager', 'penata_pelayanan', 'kepala_bidang', 'super_admin'].includes(me.role)) {
      return NextResponse.json({ error: 'Anda tidak bisa Ambil Alih tugas' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
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
    
    // PP can only take over if takeover_enabled=true
    if (me.role === 'penata_pelayanan' && !pipeline.takeover_enabled) {
      return NextResponse.json({ 
        error: 'Akses Penata Pelayanan belum dibuka. Minta CM/Kabid untuk Buka PP.' 
      }, { status: 403 })
    }
    
    const fromUserId = pipeline.current_handler_id
    
    // Update pipeline
    const { error: updErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .update({
        current_handler_id: me.id,
        handler_since: new Date().toISOString(),
        takeover_enabled: false, // auto-close takeover after taken
        takeover_enabled_by: null,
        takeover_enabled_at: null,
        takeover_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.pipeline_id)
    if (updErr) throw updErr
    
    // Log takeover
    await supabaseAdmin.from('wpa_pipeline_takeover_log').insert({
      pipeline_id: data.pipeline_id,
      from_user_id: fromUserId,
      to_user_id: me.id,
      reason: data.reason || null,
    })
    
    await supabaseAdmin.from('wpa_pipeline_access_control').insert({
      pipeline_id: data.pipeline_id,
      action: 'taken_over',
      performed_by: me.id,
      reason: data.reason || null,
    })
    
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: data.pipeline_id,
      tahap: pipeline.current_tahap,
      action: 'takeover',
      performed_by: me.id,
      catatan: `${me.full_name} (${me.role}) mengambil alih tugas${fromUserId ? ` dari handler sebelumnya` : ''}${data.reason ? `. Alasan: ${data.reason}` : ''}`,
    })
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pipeline.kantor_cabang_id,
      action: 'pipeline_takeover',
      entity_type: 'pipeline',
      entity_id: data.pipeline_id,
      after_data: { from: fromUserId, to: me.id, reason: data.reason },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true,
      message: `Anda berhasil mengambil alih tugas "${pipeline.jenis.replace(/_/g, ' ')}" (tahap: ${pipeline.current_tahap.replace(/_/g, ' ')}).`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
