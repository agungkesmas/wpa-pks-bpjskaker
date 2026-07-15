import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import mammoth from 'mammoth'
import crypto from 'crypto'

// POST /api/template/upload
// Multipart form: file (.docx), kode, nama, jenis_dokumen, versi, is_masal, judul_kartu
// 1. Upload .docx to storage bucket wpa-templates
// 2. Parse placeholders (regex {{KEY}})
// 3. Calculate hash
// 4. Insert wpa_pks_template + wpa_pks_template_placeholder
// 5. Deactivate old templates with same jenis_dokumen (if not is_masal)
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'admin_kantor') {
      return NextResponse.json({ error: 'Hanya Super Admin atau Admin Kantor' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const kode = formData.get('kode') as string
    const nama = formData.get('nama') as string
    const jenisDokumen = formData.get('jenis_dokumen') as string
    const versi = (formData.get('versi') as string) || '1.0'
    const isMasalStr = formData.get('is_masal') as string
    const isMasal = isMasalStr === 'true'
    const judulKartu = (formData.get('judul_kartu') as string) || ''

    if (!file || !kode || !nama) {
      return NextResponse.json({ error: 'File, kode, dan nama wajib diisi' }, { status: 400 })
    }
    if (isMasal && !judulKartu.trim()) {
      return NextResponse.json({ error: 'Judul kartu wajib diisi untuk template masal' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.match(/\.docx$/i)) {
      return NextResponse.json({ error: 'File harus .docx' }, { status: 400 })
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse placeholders using mammoth (extract raw text)
    const { value: htmlContent } = await mammoth.convertToHtml({ buffer })

    // Find all {{PLACEHOLDER}} patterns (uppercase letters, digits, underscore)
    const placeholderMatches = htmlContent.match(/\{\{([A-Z][A-Z0-9_]*)\}\}/g) || []
    const placeholderKeys = Array.from(new Set(
      placeholderMatches.map(m => m.replace(/[{}]/g, ''))
    ))

    // Classify placeholders:
    // - auto_fill: things we can derive from DB (NAMA_FASKES, ALAMAT, etc.)
    // - manual_required: ones PIC RS must fill (TARIF_LAMA, TANGGAL_EFEK, etc.)
    // - manual_optional: others
    const autoFillPatterns = [
      'NAMA_FASKES', 'ALAMAT_FASKES', 'KOTA_FASKES', 'PROVINSI_FASKES',
      'NAMA_PJ', 'JABATAN_PJ', 'TELP_FASKES', 'EMAIL_FASKES', 'NPWP_FASKES',
      'JENIS_FASKES', 'TIPE_FASKES', 'KODE_FASKES',
      'KODE_PKS', 'TANGGAL_PKS', 'TANGGAL_AKHIR_PKS',
      'NAMA_BANK', 'NO_REKENING', 'ATAS_NAMA', 'CABANG_BANK',
      'NAMA_KANTOR_CABANG', 'KODE_KANTOR_CABANG',
      'KABID_NAMA', 'KABID_NIP',
      'CM_NAMA', 'CM_NIP',
    ]

    const placeholders = placeholderKeys.map((key, idx) => {
      const isAutoFill = autoFillPatterns.includes(key)
      return {
        key,
        label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        tipe: isAutoFill ? 'auto_fill' : 'manual_required',
        required: !isAutoFill,  // auto_fill not required (filled by system)
        urutan: idx + 1,
        kategori: isAutoFill ? 'auto' : 'manual',
      }
    })

    // Calculate hash of whole .docx
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')

    // Storage path
    const storagePath = `${kode}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    // Upload to storage bucket wpa-templates
    const { data: uploadData, error: uploadErr } = await supabaseAdmin
      .storage
      .from('wpa-templates')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadErr) {
      console.error('Storage upload error:', uploadErr)
      throw new Error(`Gagal upload file: ${uploadErr.message}`)
    }

    // Get public URL (bucket is public for read)
    const { data: urlData } = supabaseAdmin
      .storage
      .from('wpa-templates')
      .getPublicUrl(storagePath)

    const fileUrl = urlData?.publicUrl || ''

    // Deactivate old templates with same jenis_dokumen (only if NOT masal)
    // For masal templates, we keep them separate — multiple masal templates can coexist
    if (!isMasal) {
      await supabaseAdmin
        .from('wpa_pks_template')
        .update({ is_active: false })
        .eq('jenis_dokumen', jenisDokumen)
        .neq('kode', kode)
    }

    // Insert new template
    const { data: template, error: tplErr } = await supabaseAdmin
      .from('wpa_pks_template')
      .insert({
        kode,
        nama,
        version: versi,
        jenis_dokumen: jenisDokumen,
        file_docx_url: fileUrl,
        file_docx_path: storagePath,
        placeholders: placeholderKeys,
        template_hash: fileHash,
        pasal_count: 0,  // not parsing babs here — that's a separate concern
        lampiran_count: 0,
        is_active: true,
        is_masal: isMasal,
        judul_kartu: isMasal ? judulKartu : null,
        uploaded_by: me.id,
      })
      .select('id')
      .single()
    if (tplErr) {
      console.error('Template insert error:', tplErr)
      // Rollback: delete uploaded file
      await supabaseAdmin.storage.from('wpa-templates').remove([storagePath])
      throw new Error(`Gagal simpan template: ${tplErr.message}`)
    }

    // Insert placeholders (delete old first if exists, then insert)
    await supabaseAdmin
      .from('wpa_pks_template_placeholder')
      .delete()
      .eq('template_id', template.id)

    if (placeholders.length > 0) {
      const phRows = placeholders.map(p => ({
        template_id: template.id,
        key: p.key,
        label: p.label,
        tipe: p.tipe,
        required: p.required,
        urutan: p.urutan,
        kategori: p.kategori,
      }))
      const { error: phErr } = await supabaseAdmin
        .from('wpa_pks_template_placeholder')
        .insert(phRows)
      if (phErr) {
        console.error('Placeholder insert error:', phErr)
        // Non-fatal — template is created, just no structured placeholders
      }
    }

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id,
      action: 'template_upload',
      entity_type: 'wpa_pks_template',
      entity_id: template.id,
      after_data: {
        kode,
        nama,
        jenis_dokumen: jenisDokumen,
        is_masal: isMasal,
        judul_kartu: isMasal ? judulKartu : null,
        total_placeholder: placeholders.length,
        auto_fill: placeholders.filter(p => p.tipe === 'auto_fill').length,
        manual_required: placeholders.filter(p => p.tipe === 'manual_required').length,
        file_hash: fileHash.substring(0, 16),
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      template_id: template.id,
      summary: {
        kode,
        nama,
        total_bab: 0,  // we don't parse babs in this version
        total_placeholder: placeholders.length,
        auto_fill: placeholders.filter(p => p.tipe === 'auto_fill').length,
        manual_required: placeholders.filter(p => p.tipe === 'manual_required').length,
        is_masal: isMasal,
        judul_kartu: isMasal ? judulKartu : null,
      },
    })
  } catch (e: any) {
    console.error('Template upload error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
