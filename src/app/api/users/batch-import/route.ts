import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit, hashPassword } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { randomBytes } from 'crypto'

const VALID_ROLES = ['super_admin', 'kepala_bidang', 'case_manager', 'penata_pelayanan', 'pic_rs', 'legal_rs']

function generatePassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#$%'
  const bytes = randomBytes(length)
  let pwd = ''
  for (let i = 0; i < length; i++) {
    pwd += chars[bytes[i] % chars.length]
  }
  return pwd
}

// POST /api/users/batch-import
// Query param: ?kantor_cabang_id=XXX
// Upload Excel user → parse → insert batch + generate password per user
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Hanya Super Admin/Kabid' }, { status: 403 })
    }

    // Get kantor_cabang_id from query param (user di-attach ke kantor ini)
    const { searchParams } = new URL(req.url)
    const kantorCabangId = searchParams.get('kantor_cabang_id')
    if (!kantorCabangId) {
      return NextResponse.json({ error: 'kantor_cabang_id wajib diisi' }, { status: 400 })
    }

    // Verify kantor exists
    const { data: kantor } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .select('id, nama, kode')
      .eq('id', kantorCabangId)
      .maybeSingle()
    if (!kantor) {
      return NextResponse.json({ error: 'Kantor cabang tidak ditemukan' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

    if (!file.name.match(/\.xlsx$/i)) {
      return NextResponse.json({ error: 'File harus .xlsx' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file melebihi 5MB' }, { status: 400 })
    }

    // Parse Excel
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maksimal 500 user per import' }, { status: 400 })
    }

    // Validate + normalize rows
    const errors: Array<{ row: number; message: string }> = []
    const validRows: any[] = []
    const emailSet = new Set<string>()  // cek duplikat di Excel

    rows.forEach((raw: any, idx) => {
      const rowNum = idx + 2
      const nama = String(raw.nama || raw.Nama || raw.NAMA || '').trim()
      const email = String(raw.email || raw.Email || '').trim().toLowerCase()
      const role = String(raw.role || raw.Role || '').trim().toLowerCase()
      const wa = String(raw.wa || raw.WA || raw.Wa || '').trim()

      if (!nama) {
        errors.push({ row: rowNum, message: 'Nama wajib diisi' })
        return
      }
      if (!email) {
        errors.push({ row: rowNum, message: 'Email wajib diisi' })
        return
      }
      // Basic email validation
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push({ row: rowNum, message: `Email "${email}" tidak valid` })
        return
      }
      if (!role) {
        errors.push({ row: rowNum, message: 'Role wajib diisi' })
        return
      }
      if (!VALID_ROLES.includes(role)) {
        errors.push({ row: rowNum, message: `Role "${role}" tidak valid. Pilih: ${VALID_ROLES.join(', ')}` })
        return
      }
      if (emailSet.has(email)) {
        errors.push({ row: rowNum, message: `Email "${email}" duplikat di Excel` })
        return
      }
      emailSet.add(email)

      validRows.push({ nama, email, role, wa: wa || null })
    })

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Tidak ada row valid untuk diimport',
        total_processed: rows.length,
        total_success: 0,
        total_error: errors.length,
        errors,
      }, { status: 400 })
    }

    // Cek duplikat email di DB
    const emailsToCheck = validRows.map(r => r.email)
    const { data: existingUsers } = await supabaseAdmin
      .from('wpa_users')
      .select('email')
      .in('email', emailsToCheck)

    const existingEmails = new Set((existingUsers || []).map((u: any) => (u.email || '').toLowerCase()))
    const rowsToInsert = validRows.filter(r => !existingEmails.has(r.email))
    const duplicateErrors = validRows
      .filter(r => existingEmails.has(r.email))
      .map(r => ({ row: 0, message: `Email "${r.email}" sudah ada di DB` }))

    if (rowsToInsert.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Semua user sudah ada di DB (duplikat email)',
        total_processed: rows.length,
        total_success: 0,
        total_error: errors.length + duplicateErrors.length,
        errors: [...errors, ...duplicateErrors],
      }, { status: 400 })
    }

    // Generate password + hash untuk setiap row
    const now = new Date()
    const expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)  // 7 hari

    // Hash passwords in parallel (untuk performance)
    const usersToInsert = await Promise.all(
      rowsToInsert.map(async r => {
        const password = generatePassword(12)
        const passwordHash = hashPassword(password)
        return {
          email: r.email,
          password_hash: passwordHash,
          full_name: r.nama,
          role: r.role,
          phone: r.wa,
          kantor_cabang_id: kantorCabangId,
          is_active: true,
          must_change_password: true,
          temp_password: password,  // plaintext untuk slip
          temp_password_expires_at: expiryDate.toISOString(),
          created_by: me.id,
        }
      })
    )

    // Batch insert
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('wpa_users')
      .insert(usersToInsert)
      .select('id, email, full_name, role, temp_password')

    if (insErr) {
      console.error('Batch insert user error:', insErr)
      return NextResponse.json({
        success: false,
        message: `Gagal insert: ${insErr.message}`,
        total_processed: rows.length,
        total_success: 0,
        total_error: rows.length,
        errors,
      }, { status: 500 })
    }

    const totalSuccess = (inserted || []).length
    const totalError = errors.length + duplicateErrors.length

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: kantorCabangId,
      action: 'user_batch_import',
      entity_type: 'wpa_users',
      after_data: {
        kantor_cabang_id: kantorCabangId,
        kantor_nama: kantor.nama,
        total_processed: rows.length,
        total_success: totalSuccess,
        total_error: totalError,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Berhasil import ${totalSuccess} user${totalError > 0 ? `, ${totalError} error` : ''}. Password sudah di-generate — siap print kredensial.`,
      total_processed: rows.length,
      total_success: totalSuccess,
      total_error: totalError,
      errors: [...errors, ...duplicateErrors],
      created_ids: (inserted || []).map((u: any) => u.id),
    })
  } catch (e: any) {
    console.error('Batch import user error:', e)
    return NextResponse.json({
      success: false,
      message: e.message,
      total_processed: 0,
      total_success: 0,
      total_error: 1,
      errors: [{ row: 0, message: e.message }],
    }, { status: 500 })
  }
}
