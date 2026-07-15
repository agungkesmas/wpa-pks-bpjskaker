import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { UserRole, AuthUser } from '@/lib/auth-constants'

export type { UserRole, AuthUser }

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-change-me-in-production-please-set-NEXTAUTH_SECRET-env-var'
const COOKIE_NAME = 'wpa_session'
const SESSION_MAX_AGE = 60 * 60 * 8 // 8 hours

// Note: jangan throw di build time — akan fail Vercel preview build.
// Throw hanya saat runtime jika secret masih fallback dan bukan dev.

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12)
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash)
  } catch {
    return false
  }
}

export function createToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      kantor_cabang_id: user.kantor_cabang_id,
      faskes_id: user.faskes_id,
      full_name: user.full_name,
    },
    JWT_SECRET,
    { expiresIn: SESSION_MAX_AGE }
  )
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return {
      id: decoded.id,
      email: decoded.email,
      full_name: decoded.full_name,
      role: decoded.role,
      kantor_cabang_id: decoded.kantor_cabang_id || null,
      faskes_id: decoded.faskes_id || null,
      phone: decoded.phone || null,
      nip: decoded.nip || null,
      profile_photo_url: decoded.profile_photo_url || null,
      must_change_password: decoded.must_change_password || false,
    }
  } catch {
    return null
  }
}

// Cached version — within a single request, multiple getSession() calls share one DB hit
// (Penting: cache() dari React 19 hanya bekerja dalam satu request scope, tidak cross-request)
export const getSession = cache(async (): Promise<AuthUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const user = verifyToken(token)
  if (!user) return null

  // Verify user is still active in DB
  const { data, error } = await supabaseAdmin
    .from('wpa_users')
    .select('id, email, full_name, role, kantor_cabang_id, faskes_id, phone, nip, profile_photo_url, must_change_password, is_active, last_login_at')
    .eq('id', user.id)
    .single()

  if (error || !data || !data.is_active) return null

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    kantor_cabang_id: data.kantor_cabang_id,
    faskes_id: data.faskes_id,
    phone: data.phone,
    nip: data.nip || null,
    profile_photo_url: data.profile_photo_url || null,
    must_change_password: data.must_change_password || false,
  }
})

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const { data, error } = await supabaseAdmin
    .from('wpa_users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .single()
  
  if (error || !data) return null
  if (!verifyPassword(password, data.password_hash)) return null
  
  // Update last_login_at
  await supabaseAdmin
    .from('wpa_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.id)
  
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    kantor_cabang_id: data.kantor_cabang_id,
    faskes_id: data.faskes_id,
    phone: data.phone,
    nip: data.nip || null,
    profile_photo_url: data.profile_photo_url || null,
    must_change_password: data.must_change_password || false,
  }
}

// Re-export dari wpa-utils agar bisa dipakai di server & client
export { generatePassword, generateUsername } from '@/lib/wpa-utils'

// Audit log helper
export async function logAudit(params: {
  user_id?: string
  kantor_cabang_id?: string
  action: string
  entity_type?: string
  entity_id?: string
  before_data?: any
  after_data?: any
  ip?: string
  user_agent?: string
}) {
  try {
    await supabaseAdmin.from('wpa_audit_logs').insert({
      user_id: params.user_id || null,
      kantor_cabang_id: params.kantor_cabang_id || null,
      action: params.action,
      entity_type: params.entity_type || null,
      entity_id: params.entity_id || null,
      before_data: params.before_data || null,
      after_data: params.after_data || null,
      ip: params.ip || null,
      user_agent: params.user_agent || null,
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}

// Re-export constants untuk backward compatibility (server-only usage)
export { ROLE_LABELS, ROLE_THEMES } from '@/lib/auth-constants'
