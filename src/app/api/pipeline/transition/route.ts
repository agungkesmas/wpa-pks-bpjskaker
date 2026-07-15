import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pipeline_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  action: z.enum(['advance', 'return', 'reject', 'cancel']),
  catatan: z.string().optional().or(z.literal('')),
})

// Tahap transition rules per jenis pipeline
const TAHAP_FLOW: Record<string, { current: string; next: string; handler_role: string }[]> = {
  pks_baru: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'kredensialing', handler_role: 'case_manager' },
    { current: 'kredensialing', next: 'negosiasi_tarif', handler_role: 'case_manager' },
    { current: 'negosiasi_tarif', next: 'drafting_pks', handler_role: 'case_manager' },
    { current: 'drafting_pks', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  perpanjangan: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'kredensialing_ulang', handler_role: 'case_manager' },
    { current: 'kredensialing_ulang', next: 'tinjauan_tarif', handler_role: 'case_manager' },
    { current: 'tinjauan_tarif', next: 'drafting_pks', handler_role: 'case_manager' },
    { current: 'drafting_pks', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  adendum_harga: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'negosiasi_tarif', handler_role: 'case_manager' },
    { current: 'negosiasi_tarif', next: 'drafting_adendum', handler_role: 'case_manager' },
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  adendum_dropping: [
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
  perubahan_data: [
    { current: 'diajukan', next: 'ditinjau', handler_role: 'case_manager' },
    { current: 'ditinjau', next: 'drafting_adendum', handler_role: 'case_manager' },
    { current: 'drafting_adendum', next: 'approval_kabid', handler_role: 'kepala_bidang' },
    { current: 'approval_kabid', next: 'review_legal_rs', handler_role: 'legal_rs' },
    { current: 'review_legal_rs', next: 'tanda_tangan', handler_role: 'kepala_bidang' },
    { current: 'tanda_tangan', next: '__complete__', handler_role: 'kepala_bidang' },
  ],
}

// Tahap yang bisa di-skip (conditional)
const SKIPPABLE_TAHAPS = ['negosiasi_tarif']

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    const data = schema.parse(body)
    
    // Get pipeline
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .select('*')
      .eq('id', data.pipeline_id)
      .single()
    if (pErr || !pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })
    
    // Access control
    if (me.role !== 'super_admin' && pipeline.kantor_cabang_id !== me.kantor_cabang_id) {
      // PIC RS & Legal RS: cek via faskes
      if (me.role === 'pic_rs' || me.role === 'legal_rs') {
        if (pipeline.faskes_id !== me.faskes_id) {
          return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
      }
    }
    
    // Get flow for this jenis
    const flow = TAHAP_FLOW[pipeline.jenis]
    if (!flow) return NextResponse.json({ error: 'Jenis pipeline tidak dikenal' }, { status: 400 })
    
    // Find current tahap in flow
    const currentStep = flow.find(s => s.current === pipeline.current_tahap)
    if (!currentStep) return NextResponse.json({ error: 'Tahap tidak ditemukan dalam flow' }, { status: 400 })
    
    if (data.action === 'advance') {
      // Check role authorization
      const allowedRoles = currentStep.handler_role === 'case_manager' 
        ? ['case_manager', 'penata_pelayanan', 'kepala_bidang', 'super_admin']
        : currentStep.handler_role === 'kepala_bidang'
        ? ['kepala_bidang', 'super_admin']
        : currentStep.handler_role === 'legal_rs'
        ? ['legal_rs', 'super_admin']
        : ['super_admin']
      
      if (!allowedRoles.includes(me.role)) {
        return NextResponse.json({ 
          error: `Hanya ${currentStep.handler_role} yang bisa advance tahap ini` 
        }, { status: 403 })
      }
      
      // Check if current handler is me (or super_admin override)
      if (me.role !== 'super_admin' && pipeline.current_handler_id !== me.id && pipeline.current_handler_id !== null) {
        return NextResponse.json({ 
          error: 'Anda bukan handler tugas ini. Gunakan Ambil Alih terlebih dahulu.' 
        }, { status: 403 })
      }
      
      // Calculate SLA actual
      const slaActualHours = pipeline.handler_since 
        ? Math.round((Date.now() - new Date(pipeline.handler_since).getTime()) / (1000 * 60 * 60) * 10) / 10
        : null
      
      // Log current tahap as complete
      await supabaseAdmin.from('wpa_pipeline_log').insert({
        pipeline_id: pipeline.id,
        tahap: pipeline.current_tahap,
        action: 'complete',
        from_tahap: pipeline.current_tahap,
        to_tahap: currentStep.next === '__complete__' ? 'completed' : currentStep.next,
        performed_by: me.id,
        catatan: data.catatan || null,
        sla_actual_hours: slaActualHours,
      })
      
      if (currentStep.next === '__complete__') {
        // Pipeline complete!
        const { error: updErr } = await supabaseAdmin
          .from('wpa_pipeline')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            current_tahap: 'completed',
            current_handler_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pipeline.id)
        if (updErr) throw updErr
        
        // If pks_baru: update faskes status to 'aktif'
        if (pipeline.jenis === 'pks_baru' && pipeline.faskes_id) {
          await supabaseAdmin
            .from('wpa_faskes')
            .update({ status: 'aktif' })
            .eq('id', pipeline.faskes_id)
        }
        
        // Notify initiator
        if (pipeline.initiated_by) {
          await supabaseAdmin.from('wpa_notifications').insert({
            user_id: pipeline.initiated_by,
            kantor_cabang_id: pipeline.kantor_cabang_id,
            type: 'pipeline_completed',
            title: 'Pengajuan Selesai!',
            body: `Pengajuan ${pipeline.jenis.replace(/_/g, ' ')} telah selesai diproses.`,
            related_entity: 'pipeline',
            related_id: pipeline.id,
          })
        }
        
        return NextResponse.json({ success: true, message: 'Pipeline selesai! Status: completed.' })
      }
      
      // Advance to next tahap
      // Get SLA config for next tahap
      const { data: tahapConfig } = await supabaseAdmin
        .from('wpa_pipeline_tahap_config')
        .select('default_sla_days, handler_role')
        .eq('jenis_pipeline', pipeline.jenis)
        .eq('tahap', currentStep.next)
        .maybeSingle()
      
      const slaDays = tahapConfig?.default_sla_days || 7
      const slaDeadline = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()
      const nextHandlerRole = tahapConfig?.handler_role || currentStep.handler_role
      
      // Auto-assign to handler based on role
      let nextHandlerId: string | null = null
      if (nextHandlerRole === 'case_manager' || nextHandlerRole === 'penata_pelayanan') {
        // Keep current handler if they are CM/PP
        if (['case_manager', 'penata_pelayanan'].includes(me.role)) {
          nextHandlerId = me.id
        } else {
          // Find CM in kantor cabang
          const { data: cm } = await supabaseAdmin
            .from('wpa_users')
            .select('id')
            .eq('kantor_cabang_id', pipeline.kantor_cabang_id)
            .eq('role', 'case_manager')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()
          nextHandlerId = cm?.id || null
        }
      } else if (nextHandlerRole === 'kepala_bidang') {
        const { data: kabid } = await supabaseAdmin
          .from('wpa_users')
          .select('id')
          .eq('kantor_cabang_id', pipeline.kantor_cabang_id)
          .eq('role', 'kepala_bidang')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        nextHandlerId = kabid?.id || null
      } else if (nextHandlerRole === 'legal_rs' && pipeline.faskes_id) {
        const { data: legalRs } = await supabaseAdmin
          .from('wpa_user_faskes')
          .select('user_id')
          .eq('faskes_id', pipeline.faskes_id)
          .limit(1)
          .maybeSingle()
        nextHandlerId = legalRs?.user_id || null
      }
      
      // Update pipeline
      const { error: updErr } = await supabaseAdmin
        .from('wpa_pipeline')
        .update({
          current_tahap: currentStep.next,
          current_handler_id: nextHandlerId,
          handler_since: new Date().toISOString(),
          sla_deadline: slaDeadline,
          sla_breached: false,
          takeover_enabled: false, // reset takeover when advancing
          takeover_enabled_by: null,
          takeover_enabled_at: null,
          takeover_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pipeline.id)
      if (updErr) throw updErr
      
      // Log enter next tahap
      await supabaseAdmin.from('wpa_pipeline_log').insert({
        pipeline_id: pipeline.id,
        tahap: currentStep.next,
        action: 'enter',
        performed_by: me.id,
        catatan: `Tahap ${currentStep.next} dimulai, handler: ${nextHandlerRole}`,
      })
      
      // Notify next handler
      if (nextHandlerId) {
        await supabaseAdmin.from('wpa_notifications').insert({
          user_id: nextHandlerId,
          kantor_cabang_id: pipeline.kantor_cabang_id,
          type: 'pipeline_tahap_baru',
          title: 'Tugas Baru: Tahap Berikutnya',
          body: `Pengajuan ${pipeline.jenis.replace(/_/g, ' ')} masuk ke tahap: ${currentStep.next.replace(/_/g, ' ')}. Mohon ditindak lanjuti.`,
          related_entity: 'pipeline',
          related_id: pipeline.id,
        })
      }
      
      // Notify PIC RS when entering review_legal_rs
      if (currentStep.next === 'review_legal_rs' && pipeline.faskes_id) {
        const { data: picRs } = await supabaseAdmin
          .from('wpa_user_faskes')
          .select('user_id')
          .eq('faskes_id', pipeline.faskes_id)
          .eq('is_primary', true)
          .limit(1)
          .maybeSingle()
        if (picRs) {
          await supabaseAdmin.from('wpa_notifications').insert({
            user_id: picRs.user_id,
            type: 'pipeline_review_legal_rs',
            title: 'PKS/Adendum Menunggu Review Legal RS',
            body: `Dokumen menunggu review Legal RS Anda. Mohon ditinjau.`,
            related_entity: 'pipeline',
            related_id: pipeline.id,
          })
        }
      }
      
      await logAudit({
        user_id: me.id,
        kantor_cabang_id: pipeline.kantor_cabang_id,
        action: 'pipeline_advance',
        entity_type: 'pipeline',
        entity_id: pipeline.id,
        after_data: { from: pipeline.current_tahap, to: currentStep.next, sla_hours: slaActualHours },
        ip: req.headers.get('x-forwarded-for') || undefined,
        user_agent: req.headers.get('user-agent') || undefined,
      })
      
      return NextResponse.json({ 
        success: true, 
        message: `Tahap "${currentStep.next.replace(/_/g, ' ')}" dimulai. Handler: ${nextHandlerRole}.`,
        next_tahap: currentStep.next,
        next_handler_role: nextHandlerRole,
      })
      
    } else if (data.action === 'return') {
      // Return to previous tahap
      const prevStep = flow.reverse().find(s => s.next === pipeline.current_tahap)
      if (!prevStep) return NextResponse.json({ error: 'Tidak ada tahap sebelumnya' }, { status: 400 })
      
      await supabaseAdmin.from('wpa_pipeline_log').insert({
        pipeline_id: pipeline.id,
        tahap: pipeline.current_tahap,
        action: 'return',
        from_tahap: pipeline.current_tahap,
        to_tahap: prevStep.current,
        performed_by: me.id,
        catatan: data.catatan || 'Dikembalikan ke tahap sebelumnya',
      })
      
      const { error: updErr } = await supabaseAdmin
        .from('wpa_pipeline')
        .update({
          current_tahap: prevStep.current,
          current_handler_id: null,
          handler_since: null,
          takeover_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pipeline.id)
      if (updErr) throw updErr
      
      return NextResponse.json({ success: true, message: `Dikembalikan ke tahap "${prevStep.current.replace(/_/g, ' ')}"` })
      
    } else if (data.action === 'reject') {
      // Reject pipeline entirely
      await supabaseAdmin.from('wpa_pipeline_log').insert({
        pipeline_id: pipeline.id,
        tahap: pipeline.current_tahap,
        action: 'reject',
        performed_by: me.id,
        catatan: data.catatan || 'Pengajuan ditolak',
      })
      
      const { error: updErr } = await supabaseAdmin
        .from('wpa_pipeline')
        .update({
          status: 'rejected',
          completed_at: new Date().toISOString(),
          current_handler_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pipeline.id)
      if (updErr) throw updErr
      
      // Notify initiator
      if (pipeline.initiated_by) {
        await supabaseAdmin.from('wpa_notifications').insert({
          user_id: pipeline.initiated_by,
          kantor_cabang_id: pipeline.kantor_cabang_id,
          type: 'pipeline_rejected',
          title: 'Pengajuan Ditolak',
          body: `Pengajuan ${pipeline.jenis.replace(/_/g, ' ')} ditolak pada tahap ${pipeline.current_tahap.replace(/_/g, ' ')}. ${data.catatan || ''}`,
          related_entity: 'pipeline',
          related_id: pipeline.id,
        })
      }
      
      return NextResponse.json({ success: true, message: 'Pengajuan ditolak.' })
      
    } else if (data.action === 'cancel') {
      // Cancel pipeline
      const { error: updErr } = await supabaseAdmin
        .from('wpa_pipeline')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          current_handler_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pipeline.id)
      if (updErr) throw updErr
      
      await supabaseAdmin.from('wpa_pipeline_log').insert({
        pipeline_id: pipeline.id,
        tahap: pipeline.current_tahap,
        action: 'cancel',
        performed_by: me.id,
        catatan: data.catatan || 'Dibatalkan',
      })
      
      return NextResponse.json({ success: true, message: 'Pengajuan dibatalkan.' })
    }
    
    return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
  } catch (e: any) {
    console.error('Pipeline transition error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
