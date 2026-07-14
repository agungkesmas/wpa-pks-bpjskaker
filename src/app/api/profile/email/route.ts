import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, verifyPassword, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  password_lama: z.string().min(1),  // verifikasi password lama
  email_baru: z.string().email(),
  email_lama: z.string().email(),  // untuk konfirmasi user tahu email lama
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Verify email lama matches current email
    if (data.email_lama.toLowerCase() !== me.email.toLowerCase()) {
      return NextResponse.json({ error: 'Email lama tidak sesuai dengan akun Anda' }, { status: 400 })
    }
    
    // Verify password lama
    const { data: user } = await supabaseAdmin
      .from('wpa_users')
      .select('password_hash')
      .eq('id', me.id)
      .single()
    if (!user || !verifyPassword(data.password_lama, user.password_hash)) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 400 })
    }
    
    // Cek email baru tidak duplikat
    const { data: existing } = await supabaseAdmin
      .from('wpa_users')
      .select('id, email')
      .eq('email', data.email_baru.toLowerCase())
      .neq('id', me.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Email baru sudah dipakai akun lain' }, { status: 400 })
    }
    
    // Update email + reset email_verified_at (perlu re-verify)
    const { error } = await supabaseAdmin
      .from('wpa_users')
      .update({ 
        email: data.email_baru.toLowerCase(),
        email_verified_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', me.id)
    if (error) throw error
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id || undefined,
      action: 'change_email_self',
      entity_type: 'user',
      entity_id: me.id,
      before_data: { email: data.email_lama },
      after_data: { email: data.email_baru },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true,
      message: 'Email berhasil diubah. Anda akan logout otomatis, silakan login dengan email baru.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
