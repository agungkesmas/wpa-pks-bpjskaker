import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'
import { z } from 'zod'

const schema = z.object({
  user_id: z.string().uuid(),
  to_kantor_cabang_id: z.string().uuid(),
  tanggal_sk: z.string(),
  tanggal_efektif: z.string(),
  nomor_sk: z.string().optional(),
  file_sk_url: z.string().optional(),
  alasan: z.string().optional(),
  // 'instant' = langsung apply hari ini, 'scheduled' = tunggu tanggal efektif
  mode: z.enum(['instant', 'scheduled']).default('scheduled'),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Get user info
    const { data: user, error: userErr } = await supabaseAdmin
      .from('wpa_users')
      .select('id, email, full_name, kantor_cabang_id, role')
      .eq('id', data.user_id)
      .single()
    if (userErr || !user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }
    
    // Validasi: tidak boleh mutasi ke kantor yang sama
    if (user.kantor_cabang_id === data.to_kantor_cabang_id) {
      return NextResponse.json({ error: 'Kantor asal dan tujuan sama' }, { status: 400 })
    }
    
    // Cek apakah ada mutasi pending untuk user ini
    const { data: existingMutasi } = await supabaseAdmin
      .from('wpa_user_mutasi')
      .select('id, tanggal_efektif')
      .eq('user_id', data.user_id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existingMutasi) {
      return NextResponse.json({ 
        error: `User sudah punya mutasi pending (efektif ${existingMutasi.tanggal_efektif}). Cancel dulu untuk buat baru.` 
      }, { status: 400 })
    }
    
    // Insert mutasi record
    const insertData: any = {
      user_id: data.user_id,
      from_kantor_cabang_id: user.kantor_cabang_id,
      to_kantor_cabang_id: data.to_kantor_cabang_id,
      tanggal_sk: data.tanggal_sk,
      tanggal_efektif: data.tanggal_efektif,
      nomor_sk: data.nomor_sk || null,
      file_sk_url: data.file_sk_url || null,
      alasan: data.alasan || null,
      status: 'pending',
      created_by: me.id,
    }
    
    const { data: mutasi, error } = await supabaseAdmin
      .from('wpa_user_mutasi')
      .insert(insertData)
      .select()
      .single()
    if (error) throw error
    
    // Jika mode='instant', langsung apply hari ini
    if (data.mode === 'instant') {
      const today = new Date().toISOString().split('T')[0]
      const { error: updateErr } = await supabaseAdmin
        .from('wpa_users')
        .update({ 
          kantor_cabang_id: data.to_kantor_cabang_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.user_id)
      if (updateErr) throw updateErr
      
      await supabaseAdmin
        .from('wpa_user_mutasi')
        .update({ 
          status: 'active', 
          processed_at: new Date().toISOString(),
          approved_by: me.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', mutasi.id)
      
      // Notifikasi ke user
      await supabaseAdmin.from('wpa_notifications').insert({
        user_id: data.user_id,
        kantor_cabang_id: data.to_kantor_cabang_id,
        type: 'mutasi_applied',
        title: 'Mutasi Diterapkan',
        body: `Anda telah dimutasi ke kantor cabang baru (efektif ${data.tanggal_efektif}).`,
        related_entity: 'mutasi',
        related_id: mutasi.id,
      })
    } else {
      // Notifikasi ke user: mutasi dijadwalkan
      await supabaseAdmin.from('wpa_notifications').insert({
        user_id: data.user_id,
        kantor_cabang_id: user.kantor_cabang_id,
        type: 'mutasi_scheduled',
        title: 'Mutasi Dijadwalkan',
        body: `Mutasi Anda dijadwalkan efektif ${data.tanggal_efektif}. SK: ${data.nomor_sk || '-'}`,
        related_entity: 'mutasi',
        related_id: mutasi.id,
      })
    }
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: user.kantor_cabang_id || undefined,
      action: data.mode === 'instant' ? 'mutasi_instant' : 'mutasi_scheduled',
      entity_type: 'user',
      entity_id: data.user_id,
      after_data: { 
        from: user.kantor_cabang_id, 
        to: data.to_kantor_cabang_id, 
        tanggal_efektif: data.tanggal_efektif,
        nomor_sk: data.nomor_sk,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true, 
      mutasi,
      applied: data.mode === 'instant',
    })
  } catch (e: any) {
    console.error('Mutasi create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
