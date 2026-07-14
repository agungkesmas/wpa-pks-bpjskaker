import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, hashPassword, verifyPassword, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  password_lama: z.string().min(1),
  password_baru: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Get current password hash
    const { data: user, error } = await supabaseAdmin
      .from('wpa_users')
      .select('password_hash, must_change_password')
      .eq('id', me.id)
      .single()
    if (error || !user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }
    
    // Verify old password
    if (!verifyPassword(data.password_lama, user.password_hash)) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 400 })
    }
    
    // Validate new password strength
    if (data.password_baru.length < 8) {
      return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 })
    }
    if (!/[A-Z]/.test(data.password_baru) || !/[a-z]/.test(data.password_baru) || !/[0-9]/.test(data.password_baru)) {
      return NextResponse.json({ error: 'Password baru harus mengandung huruf besar, huruf kecil, dan angka' }, { status: 400 })
    }
    
    if (data.password_lama === data.password_baru) {
      return NextResponse.json({ error: 'Password baru tidak boleh sama dengan password lama' }, { status: 400 })
    }
    
    // Update password
    const newHash = hashPassword(data.password_baru)
    const { error: updErr } = await supabaseAdmin
      .from('wpa_users')
      .update({ 
        password_hash: newHash, 
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', me.id)
    if (updErr) throw updErr
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id || undefined,
      action: 'change_password_self',
      entity_type: 'user',
      entity_id: me.id,
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
