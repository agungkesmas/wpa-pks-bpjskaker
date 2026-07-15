import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pipeline_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  data_jsonb: z.record(z.string(), z.any()),
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
    
    // Get active template
    const templateJenis = pipeline.jenis === 'pks_baru' || pipeline.jenis === 'perpanjangan' ? 'pks' : 'adendum_ayat'
    const { data: template } = await supabaseAdmin
      .from('wpa_pks_template')
      .select('id, placeholders')
      .eq('jenis_dokumen', templateJenis)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (!template) return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 400 })
    
    // Check all manual_required placeholders are filled
    const { data: requiredPlaceholders } = await supabaseAdmin
      .from('wpa_pks_template_placeholder')
      .select('key')
      .eq('template_id', template.id)
      .eq('tipe', 'manual_required')
    
    const missingRequired = (requiredPlaceholders || []).filter(p => 
      !data.data_jsonb[p.key] || data.data_jsonb[p.key].toString().trim() === ''
    )
    
    // Create or update PKS record
    let pksId = pipeline.pks_id
    
    if (!pksId) {
      // Create new PKS
      const { data: pks, error: pksErr } = await supabaseAdmin
        .from('wpa_pks')
        .insert({
          faskes_id: pipeline.faskes_id,
          kantor_cabang_id: pipeline.kantor_cabang_id,
          template_id: template.id,
          jenis: pipeline.jenis === 'perpanjangan' ? 'perpanjangan' : 'pks_baru',
          parent_pks_id: pipeline.pks_id,
          pipeline_id: pipeline.id,
          status: 'draft',
          data_jsonb: data.data_jsonb,
          created_by: me.id,
        })
        .select('id')
        .single()
      if (pksErr) throw pksErr
      pksId = pks.id
      
      // Link PKS to pipeline
      await supabaseAdmin
        .from('wpa_pipeline')
        .update({ pks_id: pksId })
        .eq('id', pipeline.id)
    } else {
      // Update existing PKS
      const { error: updErr } = await supabaseAdmin
        .from('wpa_pks')
        .update({
          data_jsonb: data.data_jsonb,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pksId)
      if (updErr) throw updErr
    }
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pipeline.kantor_cabang_id,
      action: 'save_draft_pks',
      entity_type: 'pks',
      entity_id: pksId,
      after_data: { 
        pipeline_id: pipeline.id,
        fields_filled: Object.keys(data.data_jsonb).length,
        missing_required: missingRequired.length,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true,
      pks_id: pksId,
      missing_required: missingRequired.map(p => p.key),
      can_submit: missingRequired.length === 0,
    })
  } catch (e: any) {
    console.error('Drafting save error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
