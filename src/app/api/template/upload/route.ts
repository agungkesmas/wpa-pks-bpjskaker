import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'
import mammoth from 'mammoth'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya Super Admin yang bisa upload template mandatori' }, { status: 403 })
    }
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    const kode = formData.get('kode') as string
    const nama = formData.get('nama') as string
    const jenis_dokumen = formData.get('jenis_dokumen') as string || 'pks'
    const versi = formData.get('versi') as string || '1.0'
    
    if (!file || !kode || !nama) {
      return NextResponse.json({ error: 'file, kode, dan nama wajib' }, { status: 400 })
    }
    
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.docx')) {
      return NextResponse.json({ error: 'File harus .docx' }, { status: 400 })
    }
    
    const buf = Buffer.from(await file.arrayBuffer())
    
    // 1. Upload ke Supabase Storage
    const filePath = `${kode}/${versi}/${file.name}`
    const { error: uploadErr } = await supabaseAdmin
      .storage.from('wpa-templates')
      .upload(filePath, buf, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        cacheControl: '3600',
        upsert: true,
      })
    if (uploadErr) throw uploadErr
    
    const { data: { publicUrl } } = supabaseAdmin.storage.from('wpa-templates').getPublicUrl(filePath)
    
    // 2. Parse .docx untuk ekstrak teks + placeholder
    // mammoth di Node.js pakai { buffer: Buffer } (bukan arrayBuffer)
    const { value: textContent } = await mammoth.extractRawText({ buffer: buf })
    
    // 3. Hitung hash keseluruhan
    const templateHash = crypto.createHash('sha256').update(textContent).digest('hex')
    
    // 4. Deteksi struktur bab/pasal/lampiran
    const babList = detectBabStructure(textContent)
    
    // 5. Hitung hash per bab
    const babHashes: Record<string, string> = {}
    for (const bab of babList) {
      babHashes[bab.bab_id] = crypto.createHash('sha256').update(bab.content_text).digest('hex')
    }
    
    // 6. Deteksi semua placeholder {{...}}
    const placeholderRegex = /\{\{([A-Z_0-9]+)\}\}/g
    const allPlaceholders = new Set<string>()
    let match
    while ((match = placeholderRegex.exec(textContent)) !== null) {
      allPlaceholders.add(match[1])
    }
    
    // 7. Nonaktifkan template lama dengan jenis yang sama
    await supabaseAdmin
      .from('wpa_pks_template')
      .update({ is_active: false })
      .eq('jenis_dokumen', jenis_dokumen)
      .eq('is_active', true)
    
    // 8. Insert template baru
    const { data: template, error: tplErr } = await supabaseAdmin
      .from('wpa_pks_template')
      .insert({
        kode,
        nama,
        version: versi,
        jenis_dokumen,
        file_docx_url: publicUrl,
        file_docx_path: filePath,
        template_hash: templateHash,
        bab_hashes: babHashes,
        pasal_count: babList.filter(b => b.bab_type === 'pasal').length,
        lampiran_count: babList.filter(b => b.bab_type === 'lampiran').length,
        placeholders: Array.from(allPlaceholders),
        is_active: true,
        is_locked: true,
        uploaded_by: me.id,
      })
      .select()
      .single()
    if (tplErr) throw tplErr
    
    // 9. Insert bab
    const babRows = babList.map((b, i) => ({
      template_id: template.id,
      bab_id: b.bab_id,
      bab_label: b.bab_label,
      bab_type: b.bab_type,
      urutan: i + 1,
      content_text: b.content_text.substring(0, 10000),
      content_hash: babHashes[b.bab_id],
      placeholder_keys: b.placeholder_keys,
      is_active: true,
    }))
    if (babRows.length > 0) {
      // Insert satu per satu untuk handle error dengan baik
      for (const babRow of babRows) {
        const { error: babErr } = await supabaseAdmin
          .from('wpa_template_bab')
          .insert(babRow)
        if (babErr) {
          console.error(`Bab insert error for ${babRow.bab_id}:`, babErr.message)
        }
      }
    }
    
    // 10. Insert placeholder dengan klasifikasi otomatis
    const placeholderRows: any[] = []
    let urutan = 0
    for (const key of Array.from(allPlaceholders)) {
      // Cari bab yang mengandung placeholder ini
      const babs = babList.filter(b => b.placeholder_keys.includes(key))
      const babId = babs.length > 0 ? babs[0].bab_id : 'unknown'
      
      // Klasifikasi via RPC
      const { data: klasifikasi } = await supabaseAdmin
        .rpc('wpa_klasifikasi_placeholder', { p_key: key })
      
      const tipe = klasifikasi?.[0]?.tipe || 'manual_required'
      const sourceTable = klasifikasi?.[0]?.source_table || null
      const sourceColumn = klasifikasi?.[0]?.source_column || null
      
      placeholderRows.push({
        template_id: template.id,
        key,
        label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        tipe,
        source_table: sourceTable,
        source_column: sourceColumn,
        bab_id: babId,
        urutan_dalam_bab: urutan++,
        required: tipe === 'manual_required' || tipe.startsWith('auto_'),
      })
    }
    if (placeholderRows.length > 0) {
      // Hapus placeholder lama untuk template ini (kalau re-upload)
      await supabaseAdmin.from('wpa_pks_template_placeholder').delete().eq('template_id', template.id)
      await supabaseAdmin.from('wpa_pks_template_placeholder').insert(placeholderRows)
    }
    
    await logAudit({
      user_id: me.id,
      action: 'upload_template',
      entity_type: 'template',
      entity_id: template.id,
      after_data: {
        kode, nama, versi, jenis_dokumen,
        template_hash: templateHash.substring(0, 16),
        bab_count: babList.length,
        placeholder_count: allPlaceholders.size,
        auto_count: placeholderRows.filter(p => p.tipe.startsWith('auto_')).length,
        manual_required: placeholderRows.filter(p => p.tipe === 'manual_required').length,
        manual_optional: placeholderRows.filter(p => p.tipe === 'manual_optional').length,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({
      success: true,
      template_id: template.id,
      summary: {
        total_bab: babList.length,
        total_placeholder: allPlaceholders.size,
        auto_fill: placeholderRows.filter(p => p.tipe.startsWith('auto_')).length,
        manual_required: placeholderRows.filter(p => p.tipe === 'manual_required').length,
        manual_optional: placeholderRows.filter(p => p.tipe === 'manual_optional').length,
        template_hash: templateHash.substring(0, 16) + '...',
      }
    })
  } catch (e: any) {
    console.error('Template upload error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Deteksi struktur bab/pasal/lampiran dari teks
function detectBabStructure(text: string): {
  bab_id: string
  bab_label: string
  bab_type: 'cover' | 'pasal' | 'lampiran' | 'pakta' | 'other'
  content_text: string
  placeholder_keys: string[]
}[] {
  const babs: any[] = []
  const placeholderRegex = /\{\{([A-Z_0-9]+)\}\}/g
  
  // Split berdasarkan marker PASAL/LAMPIRAN/PAKTA
  const lines = text.split('\n')
  let currentBab: any = null
  let isCover = true // awal adalah cover sampai ketemu PASAL pertama
  
  for (const line of lines) {
    const trimmed = line.trim()
    const upperTrimmed = trimmed.toUpperCase()
    
    // Deteksi marker
    if (upperTrimmed.match(/^PASAL\s+\d+$/i) || upperTrimmed.match(/^PASAL\s+\d+\s*$/i)) {
      // Save previous bab
      if (currentBab) {
        const keys = Array.from(new Set(Array.from(currentBab.content_text.matchAll(placeholderRegex)).map(m => m[1])))
        currentBab.placeholder_keys = keys
        babs.push(currentBab)
      }
      const pasalNum = upperTrimmed.match(/\d+/)?.[0] || '0'
      currentBab = {
        bab_id: `pasal_${pasalNum}`,
        bab_label: `Pasal ${pasalNum}`,
        bab_type: 'pasal',
        content_text: trimmed + '\n',
        placeholder_keys: [],
      }
      isCover = false
    } else if (upperTrimmed.match(/^LAMPIRAN\s+[IVXLCDM]+/i) || upperTrimmed.match(/^LAMPIRAN\s+\d+/i)) {
      if (currentBab) {
        const keys = Array.from(new Set(Array.from(currentBab.content_text.matchAll(placeholderRegex)).map(m => m[1])))
        currentBab.placeholder_keys = keys
        babs.push(currentBab)
      }
      const lampiranNum = upperTrimmed.match(/[IVXLCDM]+|\d+/)?.[0] || 'I'
      currentBab = {
        bab_id: `lampiran_${lampiranNum.toLowerCase()}`,
        bab_label: `Lampiran ${lampiranNum}`,
        bab_type: 'lampiran',
        content_text: trimmed + '\n',
        placeholder_keys: [],
      }
      isCover = false
    } else if (upperTrimmed.includes('PAKTA INTEGRITAS') || upperTrimmed.includes('PAKTA INTEGRATED')) {
      if (currentBab) {
        const keys = Array.from(new Set(Array.from(currentBab.content_text.matchAll(placeholderRegex)).map(m => m[1])))
        currentBab.placeholder_keys = keys
        babs.push(currentBab)
      }
      currentBab = {
        bab_id: 'pakta',
        bab_label: 'Pakta Integritas',
        bab_type: 'pakta',
        content_text: trimmed + '\n',
        placeholder_keys: [],
      }
      isCover = false
    } else if (currentBab) {
      currentBab.content_text += line + '\n'
    } else if (isCover) {
      // Cover section
      if (!currentBab) {
        currentBab = {
          bab_id: 'cover',
          bab_label: 'Cover & Identitas',
          bab_type: 'cover',
          content_text: trimmed + '\n',
          placeholder_keys: [],
        }
      } else {
        currentBab.content_text += line + '\n'
      }
    }
  }
  // Save last bab
  if (currentBab) {
    const keys = Array.from(new Set(Array.from(currentBab.content_text.matchAll(placeholderRegex)).map(m => m[1])))
    currentBab.placeholder_keys = keys
    babs.push(currentBab)
  }
  
  return babs
}
