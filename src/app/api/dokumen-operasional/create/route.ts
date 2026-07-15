import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  template_operasional_id: z.string().optional(),
  kantor_cabang_id: z.string().optional(),
  faskes_id: z.string().optional(),
  pks_id: z.string().optional(),
  jenis: z.enum(['sp1','sp2','sp3','ba_visitasi','surat_edaran','undangan','surat_pemberitahuan','laporan_visitasi','ba_negosiasi','lainnya']),
  judul: z.string().min(3),
  data_jsonb: z.record(z.any()),
  bukti_urls: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !['case_manager', 'penata_pelayanan', 'kepala_bidang'].includes(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const body = await req.json()
    const data = schema.parse(body)
    
    const kantorCabangId = data.kantor_cabang_id || me.kantor_cabang_id
    if (!kantorCabangId) return NextResponse.json({ error: 'kantor_cabang_id wajib' }, { status: 400 })
    
    // Auto-generate nomor dokumen
    const prefix = data.jenis.toUpperCase().replace(/_/g, '-')
    const { count } = await supabaseAdmin
      .from('wpa_dokumen_operasional')
      .select('*', { count: 'exact', head: true })
      .eq('kantor_cabang_id', kantorCabangId)
      .eq('jenis', data.jenis)
    
    const seqNum = String((count || 0) + 1).padStart(3, '0')
    const nomorDokumen = `${prefix}.${seqNum}/${kantorCabangId.substring(0, 8).toUpperCase()}/${new Date().getFullYear()}`
    
    // Auto-fill data pokok jika faskes_id ada
    let enrichedData = { ...data.data_jsonb }
    if (data.faskes_id) {
      const { data: faskes } = await supabaseAdmin
        .from('wpa_faskes')
        .select('nama, alamat, kota, npwp, penanggung_jawab_nama, penanggung_jawab_jabatan, telp, email, bank_name, bank_rekening_number, bank_rekening_name')
        .eq('id', data.faskes_id)
        .single()
      if (faskes) {
        enrichedData = {
          ...enrichedData,
          NAMA_FASKES: faskes.nama,
          ALAMAT_FASKES: faskes.alamat,
          KOTA_FASKES: faskes.kota,
          NPWP: faskes.npwp,
          NAMA_PJ_FASKES: faskes.penanggung_jawab_nama,
          JABATAN_PJ_FASKES: faskes.penanggung_jawab_jabatan,
          TELP_FASKES: faskes.telp,
          EMAIL_FASKES: faskes.email,
          NAMA_BANK: faskes.bank_name,
          NOMOR_REKENING: faskes.bank_rekening_number,
          NAMA_REKENING: faskes.bank_rekening_name,
        }
      }
    }
    
    // Auto-fill kantor cabang
    const { data: kantor } = await supabaseAdmin
      .from('wpa_kantor_cabang')
      .select('nama, alamat, kota, telp')
      .eq('id', kantorCabangId)
      .single()
    if (kantor) {
      enrichedData = {
        ...enrichedData,
        NAMA_KANTOR_CABANG: kantor.nama,
        ALAMAT_KANTOR_CABANG: kantor.alamat,
        KOTA_KANTOR_CABANG: kantor.kota,
        TELP_KANTOR: kantor.telp,
      }
    }
    
    // Auto-fill PKS info
    if (data.pks_id) {
      const { data: pks } = await supabaseAdmin
        .from('wpa_pks')
        .select('kode_pks_pihak_pertama, kode_pks_pihak_kedua, tanggal_mulai, tanggal_berakhir')
        .eq('id', data.pks_id)
        .single()
      if (pks) {
        enrichedData = {
          ...enrichedData,
          NOMOR_PKS_PIHAK_PERTAMA: pks.kode_pks_pihak_pertama,
          NOMOR_PKS_PIHAK_KEDUA: pks.kode_pks_pihak_kedua,
          TANGGAL_MULAI_PKS: pks.tanggal_mulai,
          TANGGAL_BERAKHIR_PKS: pks.tanggal_berakhir,
        }
      }
    }
    
    // Auto-fill tanggal hari ini
    enrichedData.TANGGAL_DOKUMEN = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    enrichedData.HARI_INI = new Date().toLocaleDateString('id-ID', { weekday: 'long' })
    
    // Determine initial status
    // SP3 needs Kabid approval (3-layer); others need CM review (2-layer)
    // If CM drafts directly, skip review
    const needsReview = me.role === 'penata_pelayanan'
    const needsKabidApproval = data.jenis === 'sp3'
    
    const initialStatus = needsReview ? 'review_cm' : (needsKabidApproval ? 'review_cm' : 'approved')
    
    const { data: dokumen, error } = await supabaseAdmin
      .from('wpa_dokumen_operasional')
      .insert({
        template_operasional_id: data.template_operasional_id || null,
        kantor_cabang_id: kantorCabangId,
        faskes_id: data.faskes_id || null,
        pks_id: data.pks_id || null,
        jenis: data.jenis,
        nomor_dokumen: nomorDokumen,
        judul: data.judul,
        data_jsonb: enrichedData,
        bukti_urls: data.bukti_urls || [],
        status: initialStatus,
        drafted_by: me.id,
        drafted_at: new Date().toISOString(),
        approved_by: !needsReview ? me.id : null,
        approved_at: !needsReview ? new Date().toISOString() : null,
      })
      .select()
      .single()
    if (error) throw error
    
    // Log
    await supabaseAdmin.from('wpa_dokumen_operasional_log').insert({
      dokumen_id: dokumen.id,
      action: 'draft',
      performed_by: me.id,
      catatan: `${me.role} membuat dokumen ${data.jenis}: ${data.judul}`,
      after_data: enrichedData,
    })
    
    // If needs review → notifikasi ke CM
    if (needsReview) {
      const { data: cmList } = await supabaseAdmin
        .from('wpa_users')
        .select('id')
        .eq('kantor_cabang_id', kantorCabangId)
        .eq('role', 'case_manager')
        .eq('is_active', true)
      if (cmList && cmList.length > 0) {
        await supabaseAdmin.from('wpa_notifications').insert(
          cmList.map(cm => ({
            user_id: cm.id,
            kantor_cabang_id: kantorCabangId,
            type: 'dokumen_operasional_review',
            title: 'Dokumen Operasional Butuh Review',
            body: `${me.full_name} mengajukan ${data.jenis.toUpperCase()}: ${data.judul}. Mohon ditinjau.`,
            related_entity: 'dokumen_operasional',
            related_id: dokumen.id,
          }))
        )
      }
    }
    
    await logAudit({
      user_id: me.id,
      kantor_cabang_id: kantorCabangId,
      action: 'create_dokumen_operasional',
      entity_type: 'dokumen_operasional',
      entity_id: dokumen.id,
      after_data: { jenis: data.jenis, nomor: nomorDokumen, status: initialStatus },
      ip: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    })
    
    return NextResponse.json({ success: true, dokumen, auto_filled: Object.keys(enrichedData).length })
  } catch (e: any) {
    console.error('Dokumen operasional create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
