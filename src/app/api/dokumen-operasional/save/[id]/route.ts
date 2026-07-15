import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  html_content: z.string(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Get current data_jsonb
    const { data: dokumen, error: dErr } = await supabaseAdmin
      .from('wpa_dokumen_operasional')
      .select('data_jsonb, kantor_cabang_id, drafted_by')
      .eq('id', id)
      .single()
    if (dErr || !dokumen) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    
    // Access control
    if (me.role !== 'super_admin' && dokumen.kantor_cabang_id !== me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
    }
    
    // Merge html_content into data_jsonb
    const updatedJsonb = { ...dokumen.data_jsonb, html_content: data.html_content }
    
    const { error: updErr } = await supabaseAdmin
      .from('wpa_dokumen_operasional')
      .update({ 
        data_jsonb: updatedJsonb,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (updErr) throw updErr
    
    // Log
    await supabaseAdmin.from('wpa_dokumen_operasional_log').insert({
      dokumen_id: id,
      action: 'edit',
      performed_by: me.id,
      catatan: `${me.full_name} mengedit dokumen via WYSIWYG editor`,
    })
    
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
