import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

// POST /api/pengajuan-draft/create
// Create a DRAFT pipeline (status='in_progress', current_tahap='diajukan')
// so PIC RS can upload files to it before officially submitting.
// Once all required files are uploaded, PIC RS calls /api/pengajuan-draft/submit
// to advance pipeline to 'ditinjau'.
const schema = z.object({
  jenis: z.enum(['pks_baru', 'perpanjangan', 'adendum_harga', 'adendum_layanan_baru', 'perubahan_data']),
  pks_id: z.string().uuid().optional().nullable(),
  catatan: z.string().optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'pic_rs') return NextResponse.json({ error: 'Hanya PIC RS' }, { status: 403 })

    const body = await req.json()
    const data = schema.parse(body)

    let pksId = data.pks_id || null
    let kantorCabangId: string | null = null
    let faskesId: string | null = me.faskes_id

    if (data.jenis === 'pks_baru') {
      // === PKS BARU ===
      // PIC RS belum punya faskes. CM sudah create user dengan can_submit_pks_baru=true.
      // Saat submit PKS Baru:
      // 1. Cek can_submit_pks_baru
      // 2. Create faskes record (status: draft)
      // 3. Link PIC RS ke faskes
      // 4. Set can_submit_pks_baru=false (sudah dipakai)

      // Get user info untuk cek can_submit_pks_baru + kantor_cabang_id
      const { data: userInfo } = await supabaseAdmin
        .from('wpa_users')
        .select('id, kantor_cabang_id, can_submit_pks_baru, faskes_id')
        .eq('id', me.id)
        .single()
      if (!userInfo) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

      if (!userInfo.can_submit_pks_baru) {
        return NextResponse.json({
          error: 'Anda belum diizinkan mengajukan PKS Baru. Hubungi Case Manager BPJS untuk membuatkan akun.'
        }, { status: 403 })
      }

      // Cek tidak ada PKS Baru in-progress untuk user ini
      const { data: existingPksBaru } = await supabaseAdmin
        .from('wpa_pipeline')
        .select('id, current_tahap')
        .eq('initiated_by', me.id)
        .eq('jenis', 'pks_baru')
        .eq('status', 'in_progress')
        .limit(1)
        .maybeSingle()
      if (existingPksBaru) {
        return NextResponse.json({
          error: `Sudah ada pengajuan PKS Baru yang sedang berjalan (tahap: ${existingPksBaru.current_tahap}). Selesaikan atau batalkan dulu.`
        }, { status: 400 })
      }

      kantorCabangId = userInfo.kantor_cabang_id
      if (!kantorCabangId) {
        return NextResponse.json({ error: 'Akun PIC RS tidak terikat kantor cabang. Hubungi CM.' }, { status: 400 })
      }

      // Create faskes record (status: draft — akan diisi data lengkap saat drafting)
      const { data: newFaskes, error: faskesErr } = await supabaseAdmin
        .from('wpa_faskes')
        .insert({
          nama: `Faskes Baru — ${me.full_name}`,  // placeholder, akan di-update saat drafting
          jenis: 'Klinik',  // default, akan di-update saat drafting
          status: 'draft',
          kantor_cabang_id: kantorCabangId,
        })
        .select('id')
        .single()
      if (faskesErr) throw new Error(`Gagal buat faskes: ${faskesErr.message}`)

      faskesId = newFaskes.id

      // Link PIC RS ke faskes baru
      await supabaseAdmin
        .from('wpa_users')
        .update({
          faskes_id: faskesId,
          is_temporary: false,
          can_submit_pks_baru: false,  // sudah dipakai
        })
        .eq('id', me.id)

      // Also insert wpa_user_faskes link
      await supabaseAdmin
        .from('wpa_user_faskes')
        .upsert({
          user_id: me.id,
          faskes_id: faskesId,
          is_primary: true,
        })

    } else {
      // === NON-PKS BARU (perpanjangan, adendum, perubahan_data) ===
      // PIC RS sudah punya faskes + PKS aktif
      if (!faskesId) return NextResponse.json({ error: 'Akun PIC RS tidak terikat faskes' }, { status: 400 })

      // Validate: no in-progress pipeline of same jenis for this faskes
      const { data: existing } = await supabaseAdmin
        .from('wpa_pipeline')
        .select('id, current_tahap')
        .eq('faskes_id', faskesId)
        .eq('jenis', data.jenis)
        .eq('status', 'in_progress')
        .limit(1)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({
          error: `Sudah ada pengajuan ${data.jenis.replace(/_/g, ' ')} yang sedang berjalan (tahap: ${existing.current_tahap}). Selesaikan atau batalkan dulu.`
        }, { status: 400 })
      }

      // Require active PKS
      const { data: pks } = await supabaseAdmin
        .from('wpa_pks')
        .select('id, kode_pks_pihak_pertama, status, faskes_id, kantor_cabang_id')
        .eq('faskes_id', faskesId)
        .eq('status', 'ditandatangani')
        .order('tanggal_berakhir', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!pks) {
        return NextResponse.json({ error: 'Tidak ada PKS aktif untuk faskes ini' }, { status: 400 })
      }
      pksId = pks.id
      kantorCabangId = pks.kantor_cabang_id
    }

    if (!kantorCabangId) {
      // Fallback: get from faskes
      const { data: faskes } = await supabaseAdmin
        .from('wpa_faskes')
        .select('kantor_cabang_id')
        .eq('id', faskesId!)
        .single()
      kantorCabangId = faskes?.kantor_cabang_id || null
    }
    if (!kantorCabangId) {
      return NextResponse.json({ error: 'Faskes tidak terikat kantor cabang' }, { status: 400 })
    }

    // Get SLA for "diajukan" tahap (PIC RS submission)
    const { data: tahapConfig } = await supabaseAdmin
      .from('wpa_pipeline_tahap_config')
      .select('default_sla_days')
      .eq('jenis_pipeline', data.jenis)
      .eq('tahap', 'diajukan')
      .maybeSingle()
    const slaDays = tahapConfig?.default_sla_days || 1
    const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

    // Create pipeline (DRAFT state — PIC RS still uploading files)
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .insert({
        jenis: data.jenis,
        reference_id: pksId,
        reference_type: data.jenis === 'pks_baru' ? 'faskes' : 'pks',
        kantor_cabang_id: kantorCabangId,
        faskes_id: faskesId,
        pks_id: pksId,
        current_tahap: 'diajukan',
        current_handler_id: me.id, // PIC RS still owns it (drafting uploads)
        handler_since: new Date().toISOString(),
        cabang_owned: true,
        sla_deadline: slaDeadline,
        sla_breached: false,
        status: 'in_progress',
        initiated_by: me.id,
      })
      .select('id')
      .single()
    if (pErr) throw pErr

    // Log enter diajukan
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: pipeline.id,
      tahap: 'diajukan',
      action: 'enter',
      performed_by: me.id,
      catatan: data.catatan ? `Draft dibuat. Catatan: ${data.catatan}` : 'Draft pengajuan dibuat oleh PIC RS',
    })

    await logAudit({
      user_id: me.id,
      kantor_cabang_id: kantorCabangId,
      action: 'pipeline_draft_create',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      after_data: { jenis: data.jenis, faskes_id: faskesId },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      pipeline_id: pipeline.id,
      message: 'Draft pipeline dibuat. Upload file wajib sebelum submit.',
    })
  } catch (e: any) {
    console.error('Draft create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
