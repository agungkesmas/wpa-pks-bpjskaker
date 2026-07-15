import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  template_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  is_active: z.boolean(),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya Super Admin' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Get template info
    const { data: template, error: tErr } = await supabaseAdmin
      .from('wpa_pks_template')
      .select('id, kode, nama, jenis_dokumen, is_active')
      .eq('id', data.template_id)
      .single()
    if (tErr || !template) {
      return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
    }
    
    // Jika aktivasi: nonaktifkan template lain dengan jenis yang sama
    if (data.is_active && !template.is_active) {
      await supabaseAdmin
        .from('wpa_pks_template')
        .update({ is_active: false })
        .eq('jenis_dokumen', template.jenis_dokumen)
        .neq('id', data.template_id)
    }
    
    // Update template
    const { error: updErr } = await supabaseAdmin
      .from('wpa_pks_template')
      .update({ 
        is_active: data.is_active,
      })
      .eq('id', data.template_id)
    if (updErr) throw updErr
    
    await logAudit({
      user_id: me.id,
      action: data.is_active ? 'activate_template' : 'deactivate_template',
      entity_type: 'template',
      entity_id: data.template_id,
      after_data: { is_active: data.is_active },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true,
      message: data.is_active 
        ? `Template "${template.nama}" DIAKTIFKAN. Template lain dengan jenis "${template.jenis_dokumen}" dinonaktifkan otomatis.`
        : `Template "${template.nama}" DINONAKTIFKAN.`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
