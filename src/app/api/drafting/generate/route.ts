import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import mammoth from 'mammoth'
import crypto from 'crypto'
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
    
    // Get pipeline + PKS
    const { data: pipeline } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('*, wpa_pks(*)')
      .eq('id', data.pipeline_id)
      .single()
    if (!pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })
    
    const pks = (pipeline as any).wpa_pks
    if (!pks) return NextResponse.json({ error: 'PKS belum di-draft. Simpan draft terlebih dahulu.' }, { status: 400 })
    
    // Get template
    const { data: template } = await supabaseAdmin
      .from('wpa_pks_template')
      .select('*')
      .eq('id', pks.template_id)
      .single()
    if (!template || !template.file_docx_path) return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 400 })
    
    // Check all manual_required filled
    const { data: requiredPlaceholders } = await supabaseAdmin
      .from('wpa_pks_template_placeholder')
      .select('key')
      .eq('template_id', template.id)
      .eq('tipe', 'manual_required')
    
    const missing = (requiredPlaceholders || []).filter(p => 
      !pks.data_jsonb[p.key] || pks.data_jsonb[p.key].toString().trim() === ''
    )
    if (missing.length > 0) {
      return NextResponse.json({ 
        error: `Masih ada ${missing.length} placeholder wajib yang belum diisi`,
        missing: missing.map(p => p.key),
      }, { status: 400 })
    }
    
    // Download template .docx
    const { data: fileData, error: dlErr } = await supabaseAdmin
      .storage.from('wpa-templates')
      .download(template.file_docx_path)
    if (dlErr || !fileData) return NextResponse.json({ error: 'Gagal download template file' }, { status: 500 })
    
    // Convert to HTML via mammoth (for preview)
    const buf = Buffer.from(await fileData.arrayBuffer())
    const { value: htmlContent } = await mammoth.convertToHtml({ buffer: buf })
    
    // Replace all {{PLACEHOLDER}} with values from data_jsonb
    let filledHtml = htmlContent
    for (const [key, value] of Object.entries(pks.data_jsonb)) {
      if (key === 'html_content') continue
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      filledHtml = filledHtml.replace(regex, String(value || ''))
    }
    
    // Clean up remaining placeholders
    const remainingPlaceholders = filledHtml.match(/\{\{[A-Z_0-9]+\}\}/g)
    filledHtml = filledHtml.replace(/\{\{[A-Z_0-9]+\}\}/g, '')
    
    // Calculate hash of filled content (for validation)
    const filledHash = crypto.createHash('sha256').update(filledHtml).digest('hex')
    
    // Update PKS with HTML content + hash
    const updatedJsonb = { ...pks.data_jsonb, html_content: filledHtml }
    await supabaseAdmin
      .from('wpa_pks')
      .update({
        data_jsonb: updatedJsonb,
        file_docx_hash: filledHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pks.id)
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: pipeline.kantor_cabang_id,
      action: 'generate_pks_draft',
      entity_type: 'pks',
      entity_id: pks.id,
      after_data: { 
        pipeline_id: pipeline.id,
        hash: filledHash.substring(0, 16),
        remaining_placeholders: remainingPlaceholders?.length || 0,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true,
      pks_id: pks.id,
      html: filledHtml,
      hash: filledHash.substring(0, 16) + '...',
      remaining_placeholders: remainingPlaceholders?.length || 0,
    })
  } catch (e: any) {
    console.error('Generate error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
