import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8).optional(),
  is_active: z.boolean().optional(),
  full_name: z.string().min(2).optional(),
  phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || me.role !== 'admin_kantor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    const updateData: any = {}
    if (data.password) updateData.password_hash = hashPassword(data.password)
    if (data.is_active !== undefined) updateData.is_active = data.is_active
    if (data.full_name) updateData.full_name = data.full_name
    if (data.phone !== undefined) updateData.phone = data.phone
    updateData.updated_at = new Date().toISOString()
    
    const { data: user, error } = await supabaseAdmin
      .from('wpa_users')
      .update(updateData)
      .eq('id', data.id)
      .select('id, email, full_name, role, is_active')
      .single()
    
    if (error) throw error
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id || undefined,
      action: data.password ? 'reset_password' : 'update_user',
      entity_type: 'user',
      entity_id: user.id,
      after_data: { ...user, password: data.password ? '[REDACTED]' : undefined },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, user })
  } catch (e: any) {
    console.error('Update user error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
