import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword } from '@/lib/auth'

// One-time setup: create default admin if no users exist
export async function POST(req: NextRequest) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('wpa_users')
      .select('id')
      .limit(1)
    
    if (existing && existing.length > 0) {
      return NextResponse.json({ 
        error: 'Setup sudah dilakukan. Hubungi admin untuk pembuatan akun.' 
      }, { status: 400 })
    }
    
    const body = await req.json().catch(() => ({}))
    const email = (body.email || 'admin@wpa.local').toString().toLowerCase().trim()
    const password = (body.password || process.env.DEFAULT_ADMIN_PWD || '').toString()
    const full_name = (body.full_name || 'Administrator Kantor').toString()
    
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }
    
    const { data: kantor } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .select('id')
      .eq('kode', 'KC-DEFAULT')
      .single()
    
    const { data: user, error } = await supabaseAdmin
      .from('wpa_users')
      .insert({
        email,
        password_hash: hashPassword(password),
        full_name,
        role: 'admin_kantor',
        kantor_cabang_id: kantor?.id || null,
        is_active: true,
      })
      .select('id, email, full_name, role')
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      user,
      message: `Admin berhasil dibuat. Email: ${email}. Silakan login.`
    })
  } catch (e: any) {
    console.error('Setup error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  const { count } = await supabaseAdmin
    .from('wpa_users')
    .select('*', { count: 'exact', head: true })
  
  return NextResponse.json({ 
    needs_setup: !count || count === 0,
    user_count: count || 0
  })
}
