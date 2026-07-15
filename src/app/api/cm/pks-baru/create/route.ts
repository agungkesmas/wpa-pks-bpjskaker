import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit, hashPassword } from '@/lib/auth'
import { z } from 'zod'
import { validateDokumen, getDokumenLabel } from '@/lib/wpa-constants'
import { randomBytes } from 'crypto'

const schema = z.object({
  // Faskes data
  nama_faskes: z.string().min(3, 'Nama faskes minimal 3 karakter'),
  jenis_faskes: z.enum(['RS', 'Klinik', 'Puskesmas', 'PraktikMandiri', 'Lainnya']),
  tipe_faskes: z.enum(['A', 'B', 'C', 'D', 'Umum']).default('Umum'),
  alamat: z.string().min(5, 'Alamat minimal 5 karakter'),
  kota: z.string().min(2),
  provinsi: z.string().min(2),
  telp: z.string().min(5),
  email_faskes: z.string().email().optional().or(z.literal('')),
  npwp: z.string().optional().or(z.literal('')),

  // Penanggung Jawab (faskes)
  pj_nama: z.string().min(2),
  pj_jabatan: z.string().min(2),
  pj_phone: z.string().min(5),

  // Bank
  bank_name: z.string().optional().or(z.literal('')),
  bank_cabang: z.string().optional().or(z.literal('')),
  bank_rekening_number: z.string().optional().or(z.literal('')),
  bank_rekening_name: z.string().optional().or(z.literal('')),

  // PIC RS account (yang akan CM buatkan)
  pic_rs_email: z.string().email('Email PIC RS tidak valid'),
  pic_rs_full_name: z.string().min(2, 'Nama PIC RS minimal 2 karakter'),
  pic_rs_phone: z.string().optional().or(z.literal('')),

  // Dokumen yang sudah di-upload (list of {jenis, file_url, file_name, file_size, mime_type, storage_path})
  // CM upload file dulu via /api/pengajuan-dokumen/upload, lalu kirim list dokumen ini saat create.
  dokumen_list: z.array(z.object({
    jenis: z.string(),
    file_url: z.string(),
    file_name: z.string(),
    file_size: z.number().optional(),
    mime_type: z.string().optional(),
    storage_path: z.string().optional(),
  })).min(7, 'Minimal 7 file wajib harus diupload'),

  catatan: z.string().optional().or(z.literal('')),
})

// POST /api/cm/pks-baru/create
// CM-driven PKS Baru:
// 1. Create faskes (status: pengajuan)
// 2. Create PIC RS user (with temp password)
// 3. Link PIC RS to faskes
// 4. Create pipeline (current_tahap: ditinjau, handler: CM)
// 5. Link dokumen to pipeline
// 6. Notify PIC RS (account credentials)
// 7. Audit log
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'case_manager' && me.role !== 'super_admin' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Hanya CM/Kabid/SuperAdmin yang bisa buat PKS Baru' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })
    }

    const body = await req.json()
    const data = schema.parse(body)

    // Validate dokumen list — must have all 7 wajib files for pks_baru
    const uploadedJenisList = data.dokumen_list.map(d => d.jenis)
    const { valid, missing } = validateDokumen('pks_baru', uploadedJenisList)
    if (!valid) {
      const missingLabels = missing.map(j => getDokumenLabel(j))
      return NextResponse.json({
        error: `File wajib belum lengkap. Kurang: ${missingLabels.join(', ')}`
      }, { status: 400 })
    }

    // 1. Create faskes
    const { data: faskes, error: faskesErr } = await supabaseAdmin
      .from('wpa_faskes')
      .insert({
        nama: data.nama_faskes,
        jenis: data.jenis_faskes,
        tipe: data.tipe_faskes,
        alamat: data.alamat,
        kota: data.kota,
        provinsi: data.provinsi,
        telp: data.telp,
        email: data.email_faskes || null,
        npwp: data.npwp || null,
        penanggung_jawab_nama: data.pj_nama,
        penanggung_jawab_jabatan: data.pj_jabatan,
        penanggung_jawab_phone: data.pj_phone,
        bank_name: data.bank_name || null,
        bank_cabang: data.bank_cabang || null,
        bank_rekening_number: data.bank_rekening_number || null,
        bank_rekening_name: data.bank_rekening_name || null,
        status: 'pengajuan',
        kantor_cabang_id: me.kantor_cabang_id,
      })
      .select()
      .single()
    if (faskesErr) throw new Error(`Gagal buat faskes: ${faskesErr.message}`)

    // 2. Create PIC RS user
    // Generate temp password (8 chars alphanumeric)
    const tempPassword = randomBytes(4).toString('hex').toUpperCase() + '2026!'

    // Check email uniqueness
    const { data: existingUser } = await supabaseAdmin
      .from('wpa_users')
      .select('id')
      .eq('email', data.pic_rs_email)
      .maybeSingle()
    if (existingUser) {
      // Rollback faskes
      await supabaseAdmin.from('wpa_faskes').delete().eq('id', faskes.id)
      return NextResponse.json({
        error: `Email PIC RS "${data.pic_rs_email}" sudah terdaftar. Gunakan email lain.`
      }, { status: 400 })
    }

    const { data: picRsUser, error: userErr } = await supabaseAdmin
      .from('wpa_users')
      .insert({
        email: data.pic_rs_email,
        password_hash: hashPassword(tempPassword),
        full_name: data.pic_rs_full_name,
        role: 'pic_rs',
        phone: data.pic_rs_phone || null,
        kantor_cabang_id: me.kantor_cabang_id,
        faskes_id: faskes.id,
        is_active: true,
        must_change_password: true,
        created_by: me.id,
      })
      .select('id')
      .single()
    if (userErr) {
      // Rollback faskes
      await supabaseAdmin.from('wpa_faskes').delete().eq('id', faskes.id)
      throw new Error(`Gagal buat akun PIC RS: ${userErr.message}`)
    }

    // 3. Link PIC RS to faskes (wpa_user_faskes)
    await supabaseAdmin
      .from('wpa_user_faskes')
      .upsert({
        user_id: picRsUser.id,
        faskes_id: faskes.id,
        is_primary: true,
      })

    // 4. Create pipeline (current_tahap: ditinjau, handler: CM)
    // Get SLA for ditinjau
    const { data: tahapConfig } = await supabaseAdmin
      .from('wpa_pipeline_tahap_config')
      .select('default_sla_days')
      .eq('jenis_pipeline', 'pks_baru')
      .eq('tahap', 'ditinjau')
      .maybeSingle()
    const slaDays = tahapConfig?.default_sla_days || 2
    const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .insert({
        jenis: 'pks_baru',
        reference_id: faskes.id,
        reference_type: 'faskes',
        kantor_cabang_id: me.kantor_cabang_id,
        faskes_id: faskes.id,
        current_tahap: 'ditinjau',  // skip diajukan (CM directly submit complete package)
        current_handler_id: me.id,
        handler_since: new Date().toISOString(),
        cabang_owned: true,
        sla_deadline: slaDeadline,
        sla_breached: false,
        status: 'in_progress',
        initiated_by: me.id,
      })
      .select('id')
      .single()
    if (pErr) {
      // Rollback user + faskes
      await supabaseAdmin.from('wpa_users').delete().eq('id', picRsUser.id)
      await supabaseAdmin.from('wpa_faskes').delete().eq('id', faskes.id)
      throw new Error(`Gagal buat pipeline: ${pErr.message}`)
    }

    // 5. Insert pipeline logs
    await supabaseAdmin.from('wpa_pipeline_log').insert([
      {
        pipeline_id: pipeline.id,
        tahap: 'diajukan',
        action: 'enter',
        performed_by: me.id,
        catatan: `PKS Baru di-input oleh CM. Faskes: ${data.nama_faskes}. Akun PIC RS: ${data.pic_rs_email}`,
      },
      {
        pipeline_id: pipeline.id,
        tahap: 'diajukan',
        action: 'complete',
        from_tahap: 'diajukan',
        to_tahap: 'ditinjau',
        performed_by: me.id,
        catatan: 'CM submit dengan semua file wajib lengkap (7 file)',
      },
      {
        pipeline_id: pipeline.id,
        tahap: 'ditinjau',
        action: 'enter',
        performed_by: me.id,
        catatan: 'Pipeline masuk tahap review CM',
      },
    ])

    // 6. Link dokumen to pipeline (insert to wpa_pengajuan_dokumen with pipeline_id)
    // Note: dokumen_list already has file_url from previous upload.
    // We just need to insert the records (or update if they exist with faskes_id only).
    const dokumenRows = data.dokumen_list.map(d => ({
      pipeline_id: pipeline.id,
      faskes_id: faskes.id,
      jenis: d.jenis as any,
      file_name: d.file_name,
      file_url: d.file_url,
      file_size: d.file_size || null,
      mime_type: d.mime_type || null,
      uploaded_by: me.id,
      catatan: d.storage_path ? `storage_path:${d.storage_path}` : null,
    }))
    const { error: docErr } = await supabaseAdmin
      .from('wpa_pengajuan_dokumen')
      .insert(dokumenRows)
    if (docErr) {
      console.error('Dokumen insert error (non-fatal):', docErr)
      // Don't fail — pipeline is created, just no dokumen records
    }

    // 7. Notify PIC RS (with credentials)
    await supabaseAdmin.from('wpa_notifications').insert({
      user_id: picRsUser.id,
      kantor_cabang_id: me.kantor_cabang_id,
      type: 'pks_baru_account_created',
      title: 'Akun PIC RS Dibuat — PKS Baru Diproses',
      body: `Halo ${data.pic_rs_full_name}, akun Anda telah dibuat oleh Case Manager BPJS untuk faskes "${data.nama_faskes}". Password sementara: ${tempPassword}. Mohon login dan ganti password Anda. Pipeline PKS Baru sedang diproses.`,
      related_entity: 'pipeline',
      related_id: pipeline.id,
    })

    // 8. Audit log
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id,
      action: 'cm_create_pks_baru',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      after_data: {
        faskes_id: faskes.id,
        faskes_nama: data.nama_faskes,
        pic_rs_user_id: picRsUser.id,
        pic_rs_email: data.pic_rs_email,
        total_dokumen: data.dokumen_list.length,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `PKS Baru berhasil dibuat. Faskes: ${data.nama_faskes}. Akun PIC RS: ${data.pic_rs_email} (password: ${tempPassword}).`,
      pipeline_id: pipeline.id,
      faskes_id: faskes.id,
      pic_rs_user_id: picRsUser.id,
      pic_rs_temp_password: tempPassword,  // returned so CM can give to PIC RS
    })
  } catch (e: any) {
    console.error('CM PKS Baru create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
