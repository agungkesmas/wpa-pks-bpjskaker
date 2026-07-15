import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import mammoth from 'mammoth'

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !['case_manager', 'penata_pelayanan', 'kepala_bidang', 'super_admin'].includes(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    const kode = formData.get('kode') as string
    const nama = formData.get('nama') as string
    const jenis = formData.get('jenis') as string
    const versi = formData.get('versi') as string || '1.0'
    
    if (!file || !kode || !nama || !jenis) {
      return NextResponse.json({ error: 'file, kode, nama, jenis wajib' }, { status: 400 })
    }
    
    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'File harus .docx' }, { status: 400 })
    }
    
    const buf = Buffer.from(await file.arrayBuffer())
    const isNational = me.role === 'super_admin'
    const kantorCabangId = isNational ? null : me.kantor_cabang_id
    
    if (!kantorCabangId && !isNational) {
      return NextResponse.json({ error: 'Anda tidak terikat ke kantor cabang' }, { status: 400 })
    }
    
    // Upload ke storage
    const filePath = `${kode}/${versi}/${file.name}`
    const { error: uploadErr } = await supabaseAdmin
      .storage.from('wpa-dok-operasional')
      .upload(filePath, buf, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      })
    if (uploadErr) throw uploadErr
    
    const { data: { publicUrl } } = supabaseAdmin.storage.from('wpa-dok-operasional').getPublicUrl(filePath)
    
    // Parse placeholder
    const { value: textContent } = await mammoth.extractRawText({ buffer: buf })
    const placeholderRegex = /\{\{([A-Z_0-9]+)\}\}/g
    const placeholders = new Set<string>()
    let match
    while ((match = placeholderRegex.exec(textContent)) !== null) {
      placeholders.add(match[1])
    }
    
    // Insert
    const { data: template, error } = await supabaseAdmin
      .from('wpa_template_operasional')
      .insert({
        kantor_cabang_id: kantorCabangId || '00000000-0000-0000-0000-000000000001',
        kode,
        nama,
        jenis,
        versi,
        file_docx_url: publicUrl,
        file_docx_path: filePath,
        placeholders: Array.from(placeholders),
        is_active: true,
        is_editable: true,
        is_national: isNational,
        uploaded_by: me.id,
      })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Kode template sudah ada' }, { status: 400 })
      throw error
    }
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: kantorCabangId || undefined,
      action: 'upload_template_operasional',
      entity_type: 'template_operasional',
      entity_id: template.id,
      after_data: { kode, nama, jenis, placeholder_count: placeholders.size, is_national: isNational },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, template, placeholder_count: placeholders.size })
  } catch (e: any) {
    console.error('Template operasional upload error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
