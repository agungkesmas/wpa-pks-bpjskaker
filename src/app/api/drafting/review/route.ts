import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  version_id: z.string().uuid(),
  action: z.enum(['approve', 'return']),
  cm_feedback: z.string().optional().or(z.literal('')),
})

// POST /api/drafting/review
// CM review draft version:
// - approve → pipeline advance ke tahap berikutnya (tanda_tangan)
// - return → PIC RS harus edit lagi (koreksi)
//   - Kalau iterasi sudah v4 → otomatis trigger CM takeover
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'case_manager' && me.role !== 'kepala_bidang' && me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya CM/Kabid yang bisa review draft' }, { status: 403 })
    }

    const body = await req.json()
    const data = schema.parse(body)

    // Get version
    const { data: version, error: vErr } = await supabaseAdmin
      .from('wpa_pks_draft_versions')
      .select('*')
      .eq('id', data.version_id)
      .single()
    if (vErr || !version) return NextResponse.json({ error: 'Version tidak ditemukan' }, { status: 404 })

    // Get pipeline
    const { data: pipeline } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('id, jenis, current_tahap, status, kantor_cabang_id, faskes_id, draft_iteration')
      .eq('id', version.pipeline_id)
      .single()
    if (!pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })

    // Access control
    if (me.role !== 'super_admin' && pipeline.kantor_cabang_id !== me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
    }

    // Version harus status 'draft' (menunggu review)
    if (version.status !== 'draft') {
      return NextResponse.json({
        error: `Version ini sudah ${version.status}. Tidak bisa di-review lagi.`
      }, { status: 400 })
    }

    if (data.action === 'approve') {
      // === APPROVE ===
      // Update version status ke 'approved'
      await supabaseAdmin
        .from('wpa_pks_draft_versions')
        .update({
          status: 'approved',
          cm_feedback: data.cm_feedback || null,
        })
        .eq('id', version.id)

      // Pipeline advance ke tahap berikutnya (tanda_tangan)
      // Get next tahap from TAHAP_FLOW
      const { TAHAP_FLOW } = await import('@/lib/wpa-constants')
      const flow = TAHAP_FLOW[pipeline.jenis]
      const currentStep = flow?.find((s: any) => s.current === pipeline.current_tahap)
      const nextTahap = currentStep?.next

      if (nextTahap && nextTahap !== '__complete__') {
        // Get SLA for next tahap
        const { data: tahapConfig } = await supabaseAdmin
          .from('wpa_pipeline_tahap_config')
          .select('default_sla_days')
          .eq('jenis_pipeline', pipeline.jenis)
          .eq('tahap', nextTahap)
          .maybeSingle()
        const slaDays = tahapConfig?.default_sla_days || 3
        const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

        await supabaseAdmin
          .from('wpa_pipeline')
          .update({
            current_tahap: nextTahap,
            sla_deadline: slaDeadline,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pipeline.id)

        // Log
        await supabaseAdmin.from('wpa_pipeline_log').insert([
          {
            pipeline_id: pipeline.id,
            tahap: 'drafting_pks',
            action: 'complete',
            from_tahap: 'drafting_pks',
            to_tahap: nextTahap,
            performed_by: me.id,
            catatan: `Draft v${version.version} disetujui CM. Lanjut ke tahap ${nextTahap}.`,
          },
          {
            pipeline_id: pipeline.id,
            tahap: nextTahap,
            action: 'enter',
            performed_by: me.id,
            catatan: `Pipeline masuk tahap ${nextTahap}`,
          },
        ])

        // Notify PIC RS
        if (pipeline.kantor_cabang_id) {
          const { data: picRsUsers } = await supabaseAdmin
            .from('wpa_users')
            .select('id')
            .eq('faskes_id', pipeline.faskes_id || null)
            .eq('role', 'pic_rs')
            .eq('is_active', true)
          if (picRsUsers && picRsUsers.length > 0) {
            await supabaseAdmin.from('wpa_notifications').insert(
              picRsUsers.map(u => ({
                user_id: u.id,
                kantor_cabang_id: pipeline.kantor_cabang_id,
                type: 'draft_approved',
                title: 'Draft PKS Disetujui CM',
                body: `Draft v${version.version} telah disetujui CM. Silakan print untuk tanda tangan basah.`,
                related_entity: 'pipeline',
                related_id: pipeline.id,
              }))
            )
          }
        }
      }

      await logAudit({
        user_id: me.id,
        kantor_cabang_id: pipeline.kantor_cabang_id || undefined,
        action: 'drafting_approve',
        entity_type: 'wpa_pks_draft_versions',
        entity_id: version.id,
        after_data: { version: version.version, action: 'approve' },
        ip: req.headers.get('x-forwarded-for') || undefined,
        user_agent: req.headers.get('user-agent') || undefined,
      })

      return NextResponse.json({
        success: true,
        message: `Draft v${version.version} disetujui. PIC RS dapat print untuk tanda tangan basah.`,
      })

    } else {
      // === RETURN (untuk koreksi) ===
      if (!data.cm_feedback || data.cm_feedback.trim().length < 5) {
        return NextResponse.json({
          error: 'Catatan koreksi wajib diisi saat return (minimal 5 karakter)'
        }, { status: 400 })
      }

      // Update version status ke 'returned'
      await supabaseAdmin
        .from('wpa_pks_draft_versions')
        .update({
          status: 'returned',
          cm_feedback: data.cm_feedback,
        })
        .eq('id', version.id)

      const currentIteration = pipeline.draft_iteration || 0
      const isLastIteration = currentIteration >= 4

      // Log
      await supabaseAdmin.from('wpa_pipeline_log').insert({
        pipeline_id: pipeline.id,
        tahap: 'drafting_pks',
        action: 'return',
        performed_by: me.id,
        catatan: `Draft v${version.version} dikembalikan untuk koreksi. Catatan: ${data.cm_feedback}${isLastIteration ? ' — CM akan takeover.' : ''}`,
      })

      if (isLastIteration) {
        // Trigger CM takeover — CM harus pilih mode (system_edit / file_upload)
        await supabaseAdmin.from('wpa_notifications').insert({
          user_id: me.id,  // notify CM sendiri
          kantor_cabang_id: pipeline.kantor_cabang_id,
          type: 'cm_takeover_required',
          title: 'CM Takeover Diperlukan',
          body: `PIC RS sudah 4x koreksi tapi masih return. Anda harus takeover draft ini. Pilih: edit di sistem ATAU upload file final.`,
          related_entity: 'pipeline',
          related_id: pipeline.id,
        })

        return NextResponse.json({
          success: true,
          message: 'Draft v4 dikembalikan. Karena sudah 4 iterasi, Anda (CM) harus takeover. Pilih mode: edit di sistem atau upload file.',
          takeover_required: true,
        })
      } else {
        // Notify PIC RS untuk koreksi
        const { data: picRsUsers } = await supabaseAdmin
          .from('wpa_users')
          .select('id')
          .eq('faskes_id', pipeline.faskes_id || null)
          .eq('role', 'pic_rs')
          .eq('is_active', true)
        if (picRsUsers && picRsUsers.length > 0) {
          await supabaseAdmin.from('wpa_notifications').insert(
            picRsUsers.map(u => ({
              user_id: u.id,
              kantor_cabang_id: pipeline.kantor_cabang_id,
              type: 'draft_returned',
              title: `Draft PKS Dikembalikan — Koreksi v${currentIteration + 1}`,
              body: `CM mengembalikan draft v${version.version} untuk koreksi. Catatan: ${data.cm_feedback}. Sisa kesempatan: ${4 - currentIteration}x.`,
              related_entity: 'pipeline',
              related_id: pipeline.id,
            }))
          )
        }

        return NextResponse.json({
          success: true,
          message: `Draft v${version.version} dikembalikan ke PIC RS untuk koreksi. Sisa kesempatan: ${4 - currentIteration}x.`,
          remaining_iterations: 4 - currentIteration,
        })
      }
    }
  } catch (e: any) {
    console.error('Review error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
