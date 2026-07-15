import { createClient } from '@supabase/supabase-js'

// Note: gunakan placeholder saat env vars tidak ada, supaya build tidak gagal
// (build Vercel preview tidak selalu punya env vars).
// Runtime calls akan fail kalau env vars belum di-set — itu expected behavior.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

// Client-side Supabase (anon key, RLS-protected)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
})

// Server-side admin client (service role, bypass RLS)
// ⚠️ ONLY use in server components / API routes. NEVER expose to client.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

export type { User, Session } from '@supabase/supabase-js'
