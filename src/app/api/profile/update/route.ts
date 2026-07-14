import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

// Update profile (phone only — name/role/kantor admin-only)
const schema = z.object({
  phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    const data = schema.parse(body)
    
    const updateData: any = { updated_at: new Date().toISOString() }
    if (data.phone !== undefined) updateData.phone = data.phone || null
    
    const { data: updated, error } = await supabaseAdmin
      .from('wpa_users')
      .update(updateData)
      .eq('id', me.id)
      .select('id, email, full_name, phone, nip, profile_photo_url, role')
      .single()
    if (error) throw error
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id || undefined,
      action: 'update_profile_self',
      entity_type: 'user',
      entity_id: me.id,
      after_data: updated,
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, user: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
