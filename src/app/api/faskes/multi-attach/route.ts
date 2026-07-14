import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'
import { z } from 'zod'

// GET: list faskes attached to a user
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id') || me.id
    
    // Self atau admin only
    if (user_id !== me.id && !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { data, error } = await supabaseAdmin
      .from('wpa_user_faskes')
      .select(`
        id, is_primary, created_at,
        wpa_faskes(id, nama, jenis, tipe, kota, status, kantor_cabang_id)
      `)
      .eq('user_id', user_id)
      .order('is_primary', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: attach faskes to user (admin only)
const attachSchema = z.object({
  user_id: z.string().uuid(),
  faskes_id: z.string().uuid(),
  is_primary: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = attachSchema.parse(body)
    
    // Cek existing
    const { data: existing } = await supabaseAdmin
      .from('wpa_user_faskes')
      .select('id')
      .eq('user_id', data.user_id)
      .eq('faskes_id', data.faskes_id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'User sudah ter-attach ke faskes ini' }, { status: 400 })
    }
    
    // Jika is_primary=true, reset primary lain
    if (data.is_primary) {
      await supabaseAdmin
        .from('wpa_user_faskes')
        .update({ is_primary: false })
        .eq('user_id', data.user_id)
      
      // Update wpa_users.faskes_id (legacy field, untuk session)
      await supabaseAdmin
        .from('wpa_users')
        .update({ faskes_id: data.faskes_id })
        .eq('id', data.user_id)
    }
    
    const { data: result, error } = await supabaseAdmin
      .from('wpa_user_faskes')
      .insert({
        user_id: data.user_id,
        faskes_id: data.faskes_id,
        is_primary: data.is_primary,
      })
      .select()
      .single()
    if (error) throw error
    
    await logAudit({
      user_id: me.id,
      action: 'attach_faskes',
      entity_type: 'user_faskes',
      entity_id: result.id,
      after_data: data,
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE: detach faskes from user
export async function DELETE(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const faskes_id = searchParams.get('faskes_id')
    
    if (!user_id || !faskes_id) {
      return NextResponse.json({ error: 'user_id dan faskes_id wajib' }, { status: 400 })
    }
    
    // Cek tidak boleh hapus primary jika itu satu-satunya
    const { data: allFaskes } = await supabaseAdmin
      .from('wpa_user_faskes')
      .select('id, is_primary')
      .eq('user_id', user_id)
    if (allFaskes && allFaskes.length === 1) {
      return NextResponse.json({ error: 'Tidak boleh hapus faskes terakhir. Set faskes lain sebagai primary dulu.' }, { status: 400 })
    }
    
    const { error } = await supabaseAdmin
      .from('wpa_user_faskes')
      .delete()
      .eq('user_id', user_id)
      .eq('faskes_id', faskes_id)
    if (error) throw error
    
    await logAudit({
      user_id: me.id,
      action: 'detach_faskes',
      entity_type: 'user_faskes',
      after_data: { user_id, faskes_id },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
