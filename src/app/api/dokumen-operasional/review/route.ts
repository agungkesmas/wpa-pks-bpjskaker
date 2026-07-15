import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  dokumen_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  action: z.enum(['approve', 'reject', 'edit']),
  catatan: z.string().optional().or(z.literal('')),
  data_jsonb: z.record(z.string(), z.any()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !['case_manager', 'kepala_bidang'].includes(me.role)) {
      return NextResponse.json({ error: 'Hanya CM atau Kabid yang bisa review' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    const { data: dokumen, error: dErr } = await supabaseAdmin
      .from('wpa_dokumen_operasional')
      .select('*')
      .eq('id', data.dokumen_id)
      .single()
    if (dErr || !dokumen) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    
    if (dokumen.kantor_cabang_id !== me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
    }
    
    let updateData: any = {}
    let logAction = data.action
    
    if (data.action === 'approve') {
      // CM approve SP1/SP2 → langsung approved (siap kirim)
      // CM approve SP3 → forwarded to Kabid for final approval
      if (dokumen.jenis === 'sp3' && me.role === 'case_manager') {
        updateData = {
          status: 'review_cm',
          reviewed_by: me.id,
          reviewed_at: new Date().toISOString(),
          review_catatan: data.catatan || null,
        }
        logAction = 'approve'
        // Notifikasi ke Kabid
        const { data: kabid } = await supabaseAdmin
          .from('wpa_users')
          .select('id')
          .eq('kantor_cabang_id', dokumen.kantor_cabang_id)
          .eq('role', 'kepala_bidang')
          .eq('is_active', true)
          .limit(1)
        if (kabid && kabid.length > 0) {
          await supabaseAdmin.from('wpa_notifications').insert({
            user_id: kabid[0].id,
            kantor_cabang_id: dokumen.kantor_cabang_id,
            type: 'sp3_approval_needed',
            title: 'SP3 Butuh Approval',
            body: `SP3 untuk ${dokumen.judul} butuh approval Anda.`,
            related_entity: 'dokumen_operasional',
            related_id: dokumen.id,
          })
        }
      } else {
        // Direct approve (CM untuk SP1/SP2, Kabid untuk SP3)
        updateData = {
          status: 'approved',
          reviewed_by: me.role === 'case_manager' ? me.id : dokumen.reviewed_by,
          reviewed_at: me.role === 'case_manager' ? new Date().toISOString() : dokumen.reviewed_at,
          approved_by: me.id,
          approved_at: new Date().toISOString(),
          review_catatan: data.catatan || null,
        }
      }
    } else if (data.action === 'reject') {
      updateData = {
        status: 'rejected',
        reviewed_by: me.id,
        reviewed_at: new Date().toISOString(),
        review_catatan: data.catatan || 'Ditolak',
      }
      // Notifikasi ke drafter
      await supabaseAdmin.from('wpa_notifications').insert({
        user_id: dokumen.drafted_by,
        kantor_cabang_id: dokumen.kantor_cabang_id,
        type: 'dokumen_rejected',
        title: 'Dokumen Ditolak',
        body: `Dokumen "${dokumen.judul}" ditolak oleh ${me.full_name}. ${data.catatan || ''}`,
        related_entity: 'dokumen_operasional',
        related_id: dokumen.id,
      })
    } else if (data.action === 'edit') {
      updateData = {
        data_jsonb: data.data_jsonb || dokumen.data_jsonb,
        updated_at: new Date().toISOString(),
      }
    }
    
    const { error: updErr } = await supabaseAdmin
      .from('wpa_dokumen_operasional')
      .update(updateData)
      .eq('id', data.dokumen_id)
    if (updErr) throw updErr
    
    await supabaseAdmin.from('wpa_dokumen_operasional_log').insert({
      dokumen_id: data.dokumen_id,
      action: logAction,
      performed_by: me.id,
      catatan: data.catatan || null,
      after_data: updateData,
    })
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: dokumen.kantor_cabang_id,
      action: `review_dokumen_operasional_${data.action}`,
      entity_type: 'dokumen_operasional',
      entity_id: data.dokumen_id,
      after_data: updateData,
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true,
      message: data.action === 'approve' 
        ? (dokumen.jenis === 'sp3' && me.role === 'case_manager' ? 'SP3 diteruskan ke Kabid untuk approval' : 'Dokumen disetujui')
        : data.action === 'reject' ? 'Dokumen ditolak' : 'Dokumen diperbarui'
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
