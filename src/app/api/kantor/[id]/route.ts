import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'

// GET: detail kantor + stats
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    
    const { data: kantor, error } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !kantor) {
      return NextResponse.json({ error: 'Kantor tidak ditemukan' }, { status: 404 })
    }
    
    // admin_kantor hanya lihat cabangnya sendiri
    if ((me.role as string) === 'admin_kantor' && me.kantor_cabang_id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    return NextResponse.json({ data: kantor })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH: update kantor
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    
    // admin_kantor hanya update cabangnya sendiri
    if ((me.role as string) === 'admin_kantor' && me.kantor_cabang_id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const body = await req.json()
    const allowed = ['nama', 'alamat', 'kota', 'provinsi', 'telp', 'email', 'is_active']
    const updateData: any = { updated_at: new Date().toISOString() }
    for (const k of allowed) {
      if (body[k] !== undefined) updateData[k] = body[k]
    }
    
    const { data: before } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .select('*')
      .eq('id', id)
      .single()
    
    const { data, error } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: id,
      action: 'update_kantor',
      entity_type: 'kantor_cabang',
      entity_id: id,
      before_data: before,
      after_data: data,
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
