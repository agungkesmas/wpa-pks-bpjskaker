import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'File wajib' }, { status: 400 })
    }
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File harus gambar' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran maksimal 2MB' }, { status: 400 })
    }
    
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${me.id}-${Date.now()}.${ext}`
    const filePath = `photos/${fileName}`
    
    // Upload to Supabase Storage
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: uploadErr } = await supabaseAdmin
      .storage
      .from('wpa-profile-photos')
      .upload(filePath, buf, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      })
    if (uploadErr) throw uploadErr
    
    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('wpa-profile-photos')
      .getPublicUrl(filePath)
    
    // Update user
    const { error: updErr } = await supabaseAdmin
      .from('wpa_users')
      .update({ 
        profile_photo_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', me.id)
    if (updErr) throw updErr
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id || undefined,
      action: 'upload_photo_self',
      entity_type: 'user',
      entity_id: me.id,
      after_data: { profile_photo_url: publicUrl },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, url: publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
