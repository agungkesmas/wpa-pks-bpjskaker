import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'

// POST: cancel mutasi pending (jika belum efektif)
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await req.json()
    const { mutasi_id, alasan_cancel } = body
    
    const { data: mutasi, error: findErr } = await supabaseAdmin
      .from('wpa_user_mutasi')
      .select('*')
      .eq('id', mutasi_id)
      .single()
    if (findErr || !mutasi) {
      return NextResponse.json({ error: 'Mutasi tidak ditemukan' }, { status: 404 })
    }
    
    if (mutasi.status === 'active') {
      return NextResponse.json({ error: 'Mutasi sudah active, tidak bisa cancel' }, { status: 400 })
    }
    if (mutasi.status === 'cancelled') {
      return NextResponse.json({ error: 'Mutasi sudah cancelled' }, { status: 400 })
    }
    
    const { error } = await supabaseAdmin
      .from('wpa_user_mutasi')
      .update({ 
        status: 'cancelled',
        approved_by: me.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', mutasi_id)
    if (error) throw error
    
    // Notifikasi ke user
    await supabaseAdmin.from('wpa_notifications').insert({
      user_id: mutasi.user_id,
      type: 'mutasi_cancelled',
      title: 'Mutasi Dibatalkan',
      body: `Mutasi yang dijadwalkan telah dibatalkan. Alasan: ${alasan_cancel || 'tidak disebutkan'}`,
      related_entity: 'mutasi',
      related_id: mutasi_id,
    })
    
    await logAudit({
      user_id: me.id,
      action: 'cancel_mutasi',
      entity_type: 'mutasi',
      entity_id: mutasi_id,
      after_data: { alasan_cancel },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
