import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, getSession, logAudit } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'
import { z } from 'zod'

const schema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8).optional(),
  is_active: z.boolean().optional(),
  full_name: z.string().min(2).optional(),
  phone: z.string().optional(),
  nip: z.string().optional(),
  role: z.enum(['super_admin', 'case_manager', 'kepala_bidang', 'penata_pelayanan', 'pic_rs', 'legal_rs']).optional(),
  kantor_cabang_id: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  faskes_id: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  temp_password: z.string().optional(),
  must_change_password: z.boolean().optional(),
  profile_photo_url: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    const updateData: any = { updated_at: new Date().toISOString() }
    if (data.password) {
      updateData.password_hash = hashPassword(data.password)
      updateData.must_change_password = true
      updateData.temp_password = data.password  // disimpan sementara untuk Slip A4
      updateData.temp_password_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 hari
    }
    if (data.is_active !== undefined) updateData.is_active = data.is_active
    if (data.full_name) updateData.full_name = data.full_name
    if (data.phone !== undefined) updateData.phone = data.phone || null
    if (data.nip !== undefined) updateData.nip = data.nip || null
    if (data.role) updateData.role = data.role
    if (data.kantor_cabang_id !== undefined) updateData.kantor_cabang_id = data.kantor_cabang_id || null
    if (data.faskes_id !== undefined) updateData.faskes_id = data.faskes_id || null
    if (data.temp_password !== undefined) {
      updateData.temp_password = data.temp_password
      updateData.temp_password_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (data.must_change_password !== undefined) updateData.must_change_password = data.must_change_password
    if (data.profile_photo_url !== undefined) updateData.profile_photo_url = data.profile_photo_url
    
    const { data: user, error } = await supabaseAdmin
      .from('wpa_users')
      .update(updateData)
      .eq('id', data.id)
      .select('id, email, full_name, role, is_active, must_change_password')
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
