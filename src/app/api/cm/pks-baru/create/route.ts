import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit, hashPassword } from '@/lib/auth'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const schema = z.object({
  pic_rs_email: z.string().email('Email PIC RS tidak valid'),
  pic_rs_full_name: z.string().min(2, 'Nama PIC RS minimal 2 karakter'),
  pic_rs_phone: z.string().optional().or(z.literal('')),
})

// POST /api/cm/pks-baru/create
// CM create user PIC RS + set marker can_submit_pks_baru=true
// CM TIDAK input data faskes, TIDAK upload file.
// PIC RS yang akan upload file + isi data saat drafting.
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'case_manager' && me.role !== 'super_admin' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Hanya CM/Kabid/SuperAdmin yang bisa create user PIC RS' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })
    }

    const body = await req.json()
    const data = schema.parse(body)

    // Check email uniqueness
    const { data: existingUser } = await supabaseAdmin
      .from('wpa_users')
      .select('id')
      .eq('email', data.pic_rs_email)
      .maybeSingle()
    if (existingUser) {
      return NextResponse.json({
        error: `Email "${data.pic_rs_email}" sudah terdaftar. Gunakan email lain.`
      }, { status: 400 })
    }

    // Generate temp password (12 chars)
    const tempPassword = randomBytes(4).toString('hex').toUpperCase() + '2026!'

    // Create PIC RS user
    const { data: picRsUser, error: userErr } = await supabaseAdmin
      .from('wpa_users')
      .insert({
        email: data.pic_rs_email,
        password_hash: hashPassword(tempPassword),
        full_name: data.pic_rs_full_name,
        role: 'pic_rs',
        phone: data.pic_rs_phone || null,
        kantor_cabang_id: me.kantor_cabang_id,
        faskes_id: null,  // belum ada faskes — akan di-link saat PIC RS submit PKS Baru
        is_active: true,
        must_change_password: true,
        is_temporary: true,
        can_submit_pks_baru: true,  // MARKER: PIC RS boleh upload PKS Baru
        temp_password: tempPassword,
        temp_password_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: me.id,
      })
      .select('id, email, full_name')
      .single()
    if (userErr) {
      throw new Error(`Gagal buat akun PIC RS: ${userErr.message}`)
    }

    // Notify PIC RS (credentials)
    await supabaseAdmin.from('wpa_notifications').insert({
      user_id: picRsUser.id,
      kantor_cabang_id: me.kantor_cabang_id,
      type: 'pks_baru_account_created',
      title: 'Akun PIC RS Dibuat — Silakan Ajukan PKS Baru',
      body: `Halo ${data.pic_rs_full_name}, akun Anda telah dibuat oleh Case Manager BPJS. Menu "PKS Baru" sudah aktif. Silakan login dan upload surat pengantar + 7 file wajib di menu "Buat Pengajuan".`,
      related_entity: 'user',
      related_id: picRsUser.id,
    })

    // Audit log
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id,
      action: 'cm_create_pic_rs_user',
      entity_type: 'wpa_users',
      entity_id: picRsUser.id,
      after_data: {
        pic_rs_email: data.pic_rs_email,
        pic_rs_full_name: data.pic_rs_full_name,
        can_submit_pks_baru: true,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Akun PIC RS "${data.pic_rs_full_name}" berhasil dibuat. Menu PKS Baru sudah aktif. Berikan kredensial ke PIC RS.`,
      pic_rs_user_id: picRsUser.id,
      pic_rs_email: data.pic_rs_email,
      pic_rs_temp_password: tempPassword,
    })
  } catch (e: any) {
    console.error('CM create PIC RS user error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
