import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  dokumen_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !['case_manager', 'kepala_bidang'].includes(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    const { data: dokumen, error: dErr } = await supabaseAdmin
      .from('wpa_dokumen_operasional')
      .select('*')
      .eq('id', data.dokumen_id)
      .single()
    if (dErr || !dokumen) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    
    if (dokumen.status !== 'approved') {
      return NextResponse.json({ error: 'Dokumen belum di-approve. Status saat ini: ' + dokumen.status }, { status: 400 })
    }
    
    if (dokumen.kantor_cabang_id !== me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Anda tidak punya akses' }, { status: 403 })
    }
    
    // Get PIC RS untuk faskes ini
    let picRsId: string | null = null
    if (dokumen.faskes_id) {
      const { data: picRs } = await supabaseAdmin
        .from('wpa_user_faskes')
        .select('user_id')
        .eq('faskes_id', dokumen.faskes_id)
        .eq('is_primary', true)
        .limit(1)
      if (picRs && picRs.length > 0) picRsId = picRs[0].user_id
    }
    
    // Update status → sent
    const { error: updErr } = await supabaseAdmin
      .from('wpa_dokumen_operasional')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_to_pic_rs_id: picRsId,
      })
      .eq('id', data.dokumen_id)
    if (updErr) throw updErr
    
    // Notifikasi ke PIC RS
    if (picRsId) {
      await supabaseAdmin.from('wpa_notifications').insert({
        user_id: picRsId,
        type: 'dokumen_operasional_received',
        title: `${dokumen.jenis.toUpperCase()} Diterima`,
        body: `Anda menerima ${dokumen.jenis.toUpperCase()} dari BPJS: ${dokumen.judul}. Nomor: ${dokumen.nomor_dokumen}`,
        related_entity: 'dokumen_operasional',
        related_id: dokumen.id,
      })
    }
    
    // Log
    await supabaseAdmin.from('wpa_dokumen_operasional_log').insert({
      dokumen_id: data.dokumen_id,
      action: 'send',
      performed_by: me.id,
      catatan: `Dikirim ke PIC RS oleh ${me.full_name}`,
    })
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: dokumen.kantor_cabang_id,
      action: 'send_dokumen_operasional',
      entity_type: 'dokumen_operasional',
      entity_id: data.dokumen_id,
      after_data: { status: 'sent', sent_to: picRsId },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ 
      success: true,
      message: `Dokumen "${dokumen.judul}" berhasil dikirim ke RS${picRsId ? '' : ' (PIC RS tidak ditemukan, dokumen tercatat sebagai sent)'}`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
