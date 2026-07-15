import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { DOKUMEN_REQUIREMENTS } from '@/lib/wpa-constants'

// POST /api/pengajuan-dokumen/upload
// Multipart form data: file (binary), pipeline_id, jenis, faskes_id (optional)
// Upload to bucket wpa-pengajuan-docs, return file URL + metadata
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const pipelineId = formData.get('pipeline_id') as string | null
    const faskesId = formData.get('faskes_id') as string | null
    const jenis = formData.get('jenis') as string | null

    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    if (!jenis) return NextResponse.json({ error: 'Jenis dokumen wajib diisi' }, { status: 400 })
    if (!pipelineId && !faskesId) {
      return NextResponse.json({ error: 'pipeline_id atau faskes_id wajib diisi' }, { status: 400 })
    }

    // Validate jenis is allowed for this pipeline's jenis
    // (for PKS Baru, only CM can upload — that's checked by route-level role gate)
    const allAllowedJenis = new Set<string>()
    Object.values(DOKUMEN_REQUIREMENTS).forEach(reqs => {
      reqs.forEach(r => allAllowedJenis.add(r.jenis))
    })
    // Also allow legacy enum values
    const legacyJenis = ['surat_pengajuan', 'akta_pendirian', 'izin_operasional', 'npwp', 'sip_dokter', 'str_dokter', 'sk_pj', 'daftar_tenaga_medis', 'surat_kuasa', 'lainnya']
    legacyJenis.forEach(j => allAllowedJenis.add(j))

    if (!allAllowedJenis.has(jenis)) {
      return NextResponse.json({ error: `Jenis dokumen "${jenis}" tidak valid` }, { status: 400 })
    }

    // Validate file type & size
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Ukuran file melebihi 10MB' }, { status: 400 })
    }

    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg', 'image/png',
    ]
    if (!allowedMimes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|xls|xlsx|csv|jpg|jpeg|png)$/i)) {
      return NextResponse.json({ error: `Tipe file tidak didukung: ${file.type || file.name}` }, { status: 400 })
    }

    // Build storage path: pipelines/<pipeline_id>/<jenis>/<timestamp>-<filename>
    const ext = file.name.split('.').pop() || 'bin'
    const timestamp = Date.now()
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 100)
    const path = pipelineId
      ? `pipelines/${pipelineId}/${jenis}/${timestamp}-${safeFileName}`
      : `faskes/${faskesId}/${jenis}/${timestamp}-${safeFileName}`

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadErr } = await supabaseAdmin
      .storage
      .from('wpa-pengajuan-docs')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr)
      throw new Error(`Gagal upload file: ${uploadErr.message}`)
    }

    // Get public URL (signed URL for private bucket)
    const { data: urlData } = await supabaseAdmin
      .storage
      .from('wpa-pengajuan-docs')
      .createSignedUrl(path, 3600 * 24 * 7) // 7 days signed URL

    const fileUrl = urlData?.signedUrl || path
    const storagePath = path

    // Insert record to wpa_pengajuan_dokumen
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('wpa_pengajuan_dokumen')
      .insert({
        pipeline_id: pipelineId || null,
        faskes_id: faskesId || null,
        jenis: jenis as any,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: me.id,
        // metadata field for storage_path (so we can regenerate signed URL later)
        catatan: `storage_path:${storagePath}`,
      })
      .select('id, file_name, file_url, file_size, mime_type, jenis, uploaded_at')
      .single()

    if (docErr) {
      console.error('DB insert error:', docErr)
      // Rollback: remove file from storage
      await supabaseAdmin.storage.from('wpa-pengajuan-docs').remove([path])
      throw new Error(`Gagal simpan metadata dokumen: ${docErr.message}`)
    }

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id || undefined,
      action: 'pengajuan_dokumen_upload',
      entity_type: 'pengajuan_dokumen',
      entity_id: doc.id,
      after_data: { pipeline_id: pipelineId || null, jenis, file_name: file.name, file_size: file.size },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    return NextResponse.json({
      success: true,
      data: doc,
      storage_path: storagePath,
    })
  } catch (e: any) {
    console.error('Dokumen upload error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
