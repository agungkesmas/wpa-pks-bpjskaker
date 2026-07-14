import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  role: z.enum(['admin_kantor', 'case_manager', 'kepala_bidang', 'pic_rs', 'legal_rs']),
  phone: z.string().optional(),
  password: z.string().min(8),
  kantor_cabang_id: z.string().optional(),
  faskes_id: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || me.role !== 'admin_kantor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Sanitize empty strings to undefined
    if (!data.kantor_cabang_id) data.kantor_cabang_id = undefined
    if (!data.faskes_id) data.faskes_id = undefined
    
    // Validate role-faskes consistency
    if ((data.role === 'pic_rs' || data.role === 'legal_rs') && !data.faskes_id) {
      return NextResponse.json({ error: 'PIC RS & Legal RS wajib punya faskes' }, { status: 400 })
    }
    
    const insertData: any = {
      email: data.email.toLowerCase(),
      full_name: data.full_name,
      role: data.role,
      phone: data.phone || null,
      password_hash: hashPassword(data.password),
      is_active: true,
      kantor_cabang_id: data.kantor_cabang_id || null,
      faskes_id: data.faskes_id || null,
      created_by: me.id,
    }
    
    const { data: user, error } = await supabaseAdmin
      .from('wpa_users')
      .insert(insertData)
      .select('id, email, full_name, role')
      .single()
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
      }
      throw error
    }
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id || undefined,
      action: 'create_user',
      entity_type: 'user',
      entity_id: user.id,
      after_data: { email: user.email, full_name: user.full_name, role: user.role },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, user })
  } catch (e: any) {
    console.error('Create user error:', e)
    return NextResponse.json({ error: e.message || 'Terjadi kesalahan' }, { status: 500 })
  }
}
