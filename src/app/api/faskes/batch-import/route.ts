import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit, hashPassword } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { randomBytes } from 'crypto'

const VALID_JENIS = ['RS', 'Klinik', 'Puskesmas', 'PraktikMandiri', 'Lainnya']

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#$%'
  const bytes = randomBytes(length)
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += chars[bytes[i] % chars.length]
  return pwd
}

// POST /api/faskes/batch-import
// Upload Excel → create/update faskes + PKS + PIC RS
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'case_manager' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Hanya CM/Kabid' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File wajib' }, { status: 400 })
    if (!file.name.match(/\.xlsx$/i)) return NextResponse.json({ error: 'File harus .xlsx' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Ukuran file melebihi 5MB' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })

    if (rows.length === 0) return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    if (rows.length > 200) return NextResponse.json({ error: 'Maksimal 200 faskes per import' }, { status: 400 })

    const errors: Array<{ row: number; message: string }> = []
    const results: Array<{ row: number; faskes: string; status: string; pic_rs_password?: string }> = []
    let totalFaskesCreated = 0, totalFaskesUpdated = 0
    let totalPksCreated = 0, totalPksUpdated = 0
    let totalPicRsCreated = 0, totalPicRsSkipped = 0

    for (let idx = 0; idx < rows.length; idx++) {
      const raw = rows[idx] as any
      const rowNum = idx + 2

      const namaFaskes = String(raw.nama_faskes || '').trim()
      const jenisFaskes = String(raw.jenis_faskes || '').trim()
      const tipeFaskes = String(raw.tipe_faskes || 'Umum').trim()
      const alamat = String(raw.alamat || '').trim()
      const kota = String(raw.kota || '').trim()
      const provinsi = String(raw.provinsi || '').trim()
      const telp = String(raw.telp || '').trim()
      const emailFaskes = String(raw.email_faskes || '').trim()
      const npwp = String(raw.npwp || '').trim()
      const pjNama = String(raw.pj_nama || '').trim()
      const pjJabatan = String(raw.pj_jabatan || '').trim()
      const pjPhone = String(raw.pj_phone || '').trim()
      const bankName = String(raw.bank_name || '').trim()
      const bankCabang = String(raw.bank_cabang || '').trim()
      const bankRekNum = String(raw.bank_rekening_number || '').trim()
      const bankRekName = String(raw.bank_rekening_name || '').trim()
      const kodePks = String(raw.kode_pks || '').trim()
      const tglMulai = String(raw.tanggal_mulai_pks || '').trim()
      const tglBerakhir = String(raw.tanggal_berakhir_pks || '').trim()
      const picRsNama = String(raw.pic_rs_nama || '').trim()
      const picRsEmail = String(raw.pic_rs_email || '').trim().toLowerCase()
      const picRsPhone = String(raw.pic_rs_phone || '').trim()

      // Validate required
      if (!namaFaskes) { errors.push({ row: rowNum, message: 'nama_faskes wajib' }); continue }
      if (!jenisFaskes || !VALID_JENIS.includes(jenisFaskes)) { errors.push({ row: rowNum, message: `jenis_faskes "${jenisFaskes}" tidak valid. Pilih: ${VALID_JENIS.join(', ')}` }); continue }
      if (!kota) { errors.push({ row: rowNum, message: 'kota wajib' }); continue }
      if (!provinsi) { errors.push({ row: rowNum, message: 'provinsi wajib' }); continue }
      if (!pjNama) { errors.push({ row: rowNum, message: 'pj_nama wajib' }); continue }
      if (!kodePks) { errors.push({ row: rowNum, message: 'kode_pks wajib' }); continue }
      if (!tglMulai) { errors.push({ row: rowNum, message: 'tanggal_mulai_pks wajib' }); continue }
      if (!tglBerakhir) { errors.push({ row: rowNum, message: 'tanggal_berakhir_pks wajib' }); continue }

      // === STEP 1: FASKES (create or update by nama) ===
      const { data: existingFaskes } = await supabaseAdmin
        .from('wpa_faskes')
        .select('id')
        .eq('nama', namaFaskes)
        .eq('kantor_cabang_id', me.kantor_cabang_id)
        .maybeSingle()

      let faskesId: string
      let faskesStatus: 'created' | 'updated'

      if (existingFaskes) {
        // Update
        const { error: updErr } = await supabaseAdmin
          .from('wpa_faskes')
          .update({
            jenis: jenisFaskes as any,
            tipe: tipeFaskes,
            alamat: alamat || null,
            kota, provinsi,
            telp: telp || null,
            email: emailFaskes || null,
            npwp: npwp || null,
            penanggung_jawab_nama: pjNama,
            penanggung_jawab_jabatan: pjJabatan || null,
            penanggung_jawab_phone: pjPhone || null,
            bank_name: bankName || null,
            bank_cabang: bankCabang || null,
            bank_rekening_number: bankRekNum || null,
            bank_rekening_name: bankRekName || null,
            status: 'aktif',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFaskes.id)
        if (updErr) { errors.push({ row: rowNum, message: `Gagal update faskes: ${updErr.message}` }); continue }
        faskesId = existingFaskes.id
        faskesStatus = 'updated'
        totalFaskesUpdated++
      } else {
        // Create
        const { data: newFaskes, error: insErr } = await supabaseAdmin
          .from('wpa_faskes')
          .insert({
            nama: namaFaskes,
            jenis: jenisFaskes as any,
            tipe: tipeFaskes,
            alamat: alamat || null,
            kota, provinsi,
            telp: telp || null,
            email: emailFaskes || null,
            npwp: npwp || null,
            penanggung_jawab_nama: pjNama,
            penanggung_jawab_jabatan: pjJabatan || null,
            penanggung_jawab_phone: pjPhone || null,
            bank_name: bankName || null,
            bank_cabang: bankCabang || null,
            bank_rekening_number: bankRekNum || null,
            bank_rekening_name: bankRekName || null,
            status: 'aktif',
            kantor_cabang_id: me.kantor_cabang_id,
          })
          .select('id')
          .single()
        if (insErr) { errors.push({ row: rowNum, message: `Gagal create faskes: ${insErr.message}` }); continue }
        faskesId = newFaskes.id
        faskesStatus = 'created'
        totalFaskesCreated++
      }

      // === STEP 2: PKS (create or update by kode_pks) ===
      const { data: existingPks } = await supabaseAdmin
        .from('wpa_pks')
        .select('id')
        .eq('kode_pks_pihak_pertama', kodePks)
        .maybeSingle()

      let pksStatus: 'created' | 'updated'

      if (existingPks) {
        await supabaseAdmin
          .from('wpa_pks')
          .update({
            faskes_id: faskesId,
            kantor_cabang_id: me.kantor_cabang_id,
            status: 'ditandatangani',
            tanggal_mulai: tglMulai,
            tanggal_berakhir: tglBerakhir,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPks.id)
        pksStatus = 'updated'
        totalPksUpdated++
      } else {
        await supabaseAdmin
          .from('wpa_pks')
          .insert({
            kode_pks_pihak_pertama: kodePks,
            faskes_id: faskesId,
            kantor_cabang_id: me.kantor_cabang_id,
            jenis: 'pks_baru',
            status: 'ditandatangani',
            tanggal_mulai: tglMulai,
            tanggal_berakhir: tglBerakhir,
            created_by: me.id,
          })
        pksStatus = 'created'
        totalPksCreated++
      }

      // === STEP 3: PIC RS (create if email provided & not exists) ===
      let picRsPassword: string | undefined
      if (picRsEmail && picRsNama) {
        const { data: existingUser } = await supabaseAdmin
          .from('wpa_users')
          .select('id')
          .eq('email', picRsEmail)
          .maybeSingle()

        if (existingUser) {
          // Skip — user already exists
          totalPicRsSkipped++
        } else {
          picRsPassword = generatePassword(12)
          const { error: userErr } = await supabaseAdmin
            .from('wpa_users')
            .insert({
              email: picRsEmail,
              password_hash: hashPassword(picRsPassword),
              full_name: picRsNama,
              role: 'pic_rs',
              phone: picRsPhone || null,
              kantor_cabang_id: me.kantor_cabang_id,
              faskes_id: faskesId,
              is_active: true,
              must_change_password: true,
              can_submit_pks_baru: false,
              temp_password: picRsPassword,
              temp_password_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              created_by: me.id,
            })
          if (userErr) {
            errors.push({ row: rowNum, message: `Faskes OK, tapi gagal create PIC RS: ${userErr.message}` })
          } else {
            // Link PIC RS to faskes
            await supabaseAdmin
              .from('wpa_user_faskes')
              .upsert({ user_id: (await supabaseAdmin.from('wpa_users').select('id').eq('email', picRsEmail).single()).data?.id, faskes_id: faskesId, is_primary: true })
            totalPicRsCreated++
          }
        }
      }

      results.push({
        row: rowNum,
        faskes: namaFaskes,
        status: `Faskes: ${faskesStatus}, PKS: ${pksStatus}${picRsEmail ? (picRsPassword ? `, PIC RS: created` : ', PIC RS: skipped') : ''}`,
        pic_rs_password: picRsPassword,
      })
    }

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: me.kantor_cabang_id,
      action: 'faskes_batch_import',
      entity_type: 'wpa_faskes',
      after_data: {
        total_rows: rows.length,
        faskes_created: totalFaskesCreated,
        faskes_updated: totalFaskesUpdated,
        pks_created: totalPksCreated,
        pks_updated: totalPksUpdated,
        pic_rs_created: totalPicRsCreated,
        pic_rs_skipped: totalPicRsSkipped,
        errors: errors.length,
      },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Import selesai: ${totalFaskesCreated} faskes baru, ${totalFaskesUpdated} updated. ${totalPksCreated} PKS baru, ${totalPksUpdated} updated. ${totalPicRsCreated} PIC RS created, ${totalPicRsSkipped} skipped.${errors.length > 0 ? ` ${errors.length} error.` : ''}`,
      total_processed: rows.length,
      total_success: results.length,
      total_error: errors.length,
      stats: { totalFaskesCreated, totalFaskesUpdated, totalPksCreated, totalPksUpdated, totalPicRsCreated, totalPicRsSkipped },
      results,
      errors,
    })
  } catch (e: any) {
    console.error('Batch import faskes error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
