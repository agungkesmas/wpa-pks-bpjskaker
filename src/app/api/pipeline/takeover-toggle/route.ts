import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pipeline_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  enabled: z.boolean(),
  reason: z.string().optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Hanya CM & Kabid yang bisa toggle takeover untuk PP
    if (!['case_manager', 'kepala_bidang'].includes(me.role)) {
      return NextResponse.json({ 
        error: 'Hanya Case Manager atau Kepala Bidang yang bisa mengatur akses Penata Pelayanan' 
      }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Cek pipeline exists & user punya akses (di kantor yang sama)
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, kantor_cabang_id, current_tahap, current_handler_id, takeover_enabled, jenis, faskes_id')
      .eq('id', data.pipeline_id)
      .single()
    if (pErr || !pipeline) {
      return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })
    }
    
    // CM hanya bisa toggle di kantor cabangnya
    if (me.kantor_cabang_id !== pipeline.kantor_cabang_id) {
      return NextResponse.json({ error: 'Anda tidak punya akses ke pipeline ini' }, { status: 403 })
    }
    
    // Update pipeline
    const { error: updErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .update({
        takeover_enabled: data.enabled,
        takeover_enabled_by: data.enabled ? me.id : null,
        takeover_enabled_at: data.enabled ? new Date().toISOString() : null,
        takeover_reason: data.enabled ? (data.reason || null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.pipeline_id)
    if (updErr) throw updErr
    
    // Log access control
    await supabaseAdmin
      .from('wpa_pipeline_access_control')
      .insert({
        pipeline_id: data.pipeline_id,
        action: data.enabled ? 'enabled_takeover' : 'disabled_takeover',
        performed_by: me.id,
        reason: data.reason || null,
      })
    
    // Notifikasi ke semua PP di kantor cabang (kalau enabled)
    if (data.enabled) {
      const { data: ppList } = await supabaseAdmin
        .from('wpa_users')
        .select('id, full_name')
        .eq('kantor_cabang_id', pipeline.kantor_cabang_id)
        .eq('role', 'penata_pelayanan')
        .eq('is_active', true)
      
      if (ppList && ppList.length > 0) {
        await supabaseAdmin.from('wpa_notifications').insert(
          ppList.map(pp => ({
            user_id: pp.id,
            kantor_cabang_id: pipeline.kantor_cabang_id,
            type: 'takeover_available',
            title: 'Tugas Tersedia untuk Diambil Alih',
            body: `${me.full_name} membuka akses Penata Pelayanan untuk tugas ${pipeline.jenis.replace(/_/g, ' ')} (tahap: ${pipeline.current_tahap.replace(/_/g, ' ')}).${data.reason ? ` Alasan: ${data.reason}` : ''}`,
            related_entity: 'pipeline',
            related_id: data.pipeline_id,
          }))
        )
      }
    }
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pipeline.kantor_cabang_id,
      action: data.enabled ? 'enable_pp_takeover' : 'disable_pp_takeover',
      entity_type: 'pipeline',
      entity_id: data.pipeline_id,
      after_data: { enabled: data.enabled, reason: data.reason },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true,
      message: data.enabled 
        ? 'Akses Penata Pelayanan DIBUKA. PP sekarang bisa Ambil Alih tugas ini.'
        : 'Akses Penata Pelayanan DITUTUP. Hanya CM/Kabid yang bisa handle tugas ini.'
    })
  } catch (e: any) {
    console.error('Takeover toggle error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
