import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, createToken, setSessionCookie, logAudit } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = (body.email || '').toString().toLowerCase().trim()
    const password = (body.password || '').toString()
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 })
    }
    
    const user = await authenticateUser(email, password)
    if (!user) {
      return NextResponse.json({ error: 'Email atau password salah, atau akun nonaktif' }, { status: 401 })
    }
    
    const token = createToken(user)
    await setSessionCookie(token)
    
    await logAudit({
      user_id: user.id,
      kantor_cabang_id: user.kantor_cabang_id || undefined,
      action: 'login',
      entity_type: 'user',
      entity_id: user.id,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ user, redirect: `/${user.role}` })
  } catch (e: any) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
