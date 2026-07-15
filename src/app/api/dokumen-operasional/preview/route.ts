import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import mammoth from 'mammoth'

// POST: Generate HTML from template + auto-fill data
// Input: { dokumen_id } or { template_operasional_id, faskes_id, data_jsonb }
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    let templateId: string | null = null
    let dataJsonb: Record<string, any> = {}
    let faskesId: string | null = null
    let kantorCabangId: string | null = me.kantor_cabang_id
    
    // If dokumen_id provided, load from DB
    if (body.dokumen_id) {
      const { data: dokumen } = await supabaseAdmin
        .from('wpa_dokumen_operasional')
        .select('template_operasional_id, data_jsonb, faskes_id, kantor_cabang_id')
        .eq('id', body.dokumen_id)
        .single()
      if (!dokumen) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
      
      templateId = dokumen.template_operasional_id
      dataJsonb = dokumen.data_jsonb || {}
      faskesId = dokumen.faskes_id
      kantorCabangId = dokumen.kantor_cabang_id
      
      // If already has html_content, return it
      if (dataJsonb.html_content) {
        return NextResponse.json({ html: dataJsonb.html_content })
      }
    } else {
      templateId = body.template_operasional_id || null
      dataJsonb = body.data_jsonb || {}
      faskesId = body.faskes_id || null
    }
    
    // If no template, generate HTML from scratch
    if (!templateId) {
      // Generate basic HTML from data
      const html = generateBasicHtml(dataJsonb, body.jenis || 'surat')
      return NextResponse.json({ html })
    }
    
    // Load template
    const { data: template } = await supabaseAdmin
      .from('wpa_template_operasional')
      .select('file_docx_url, file_docx_path, nama')
      .eq('id', templateId)
      .single()
    if (!template || !template.file_docx_path) {
      // Fallback: generate basic HTML
      const html = generateBasicHtml(dataJsonb, body.jenis || 'surat')
      return NextResponse.json({ html })
    }
    
    // Download .docx from storage
    const { data: fileData, error: dlErr } = await supabaseAdmin
      .storage.from('wpa-dok-operasional')
      .download(template.file_docx_path)
    if (dlErr || !fileData) {
      const html = generateBasicHtml(dataJsonb, body.jenis || 'surat')
      return NextResponse.json({ html, warning: 'Template file tidak ditemukan, menggunakan format dasar' })
    }
    
    // Convert .docx → HTML via mammoth
    const buf = Buffer.from(await fileData.arrayBuffer())
    const { value: htmlContent } = await mammoth.convertToHtml({ buffer: buf })
    
    // Auto-fill: replace {{PLACEHOLDER}} with values from dataJsonb
    let filledHtml = htmlContent
    for (const [key, value] of Object.entries(dataJsonb)) {
      if (key === 'html_content') continue
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      filledHtml = filledHtml.replace(regex, String(value || ''))
    }
    
    // Replace remaining placeholders with empty (clean up)
    filledHtml = filledHtml.replace(/\{\{[A-Z_0-9]+\}\}/g, '<span style="background:#fef3c7;padding:2px 4px;border-radius:2px;">[isi manual]</span>')
    
    // Add signature space at the end
    filledHtml += `
      <div style="margin-top:60px;display:flex;justify-content:space-between;">
        <div style="text-align:center;">
          <div style="border-bottom:1px solid #000;width:200px;height:60px;margin-bottom:4px;"></div>
          <div style="font-weight:600;">${dataJsonb.NAMA_KANTOR_CABANG || 'BPJS Ketenagakerjaan'}</div>
          <div style="font-size:11px;color:#666;">(Tanda tangan basah)</div>
        </div>
        <div style="text-align:center;">
          <div style="border-bottom:1px solid #000;width:200px;height:60px;margin-bottom:4px;"></div>
          <div style="font-weight:600;">${dataJsonb.NAMA_FASKES || dataJsonb.NAMA_PJ_FASKES || 'Faskes'}</div>
          <div style="font-size:11px;color:#666;">(Tanda tangan basah)</div>
        </div>
      </div>
    `
    
    return NextResponse.json({ html: filledHtml })
  } catch (e: any) {
    console.error('Preview error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function generateBasicHtml(data: Record<string, any>, jenis: string): string {
  const jenisLabel: Record<string, string> = {
    sp1: 'Surat Peringatan 1 (SP1)',
    sp2: 'Surat Peringatan 2 (SP2)',
    sp3: 'Surat Peringatan 3 (SP3)',
    ba_visitasi: 'Berita Acara Visitasi',
    surat_edaran: 'Surat Edaran',
    undangan: 'Undangan',
    surat_pemberitahuan: 'Surat Pemberitahuan',
    laporan_visitasi: 'Laporan Visitasi',
    ba_negosiasi: 'Berita Acara Negosiasi',
    lainnya: 'Surat',
  }
  
  return `
    <div style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;max-width:210mm;margin:0 auto;padding:20mm;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0;">${data.NAMA_KANTOR_CABANG || 'BPJS Ketenagakerjaan'}</h2>
        <p style="font-size:10pt;color:#666;margin:2px 0;">${data.ALAMAT_KANTOR_CABANG || ''}, ${data.KOTA_KANTOR_CABANG || ''}<br/>Telp: ${data.TELP_KANTOR || ''}</p>
      </div>
      <hr style="border:1px solid #333;margin:10px 0 20px;"/>
      
      <h3 style="text-align:center;text-decoration:underline;">${jenisLabel[jenis] || 'Surat'}</h3>
      <p style="text-align:right;">Nomor: ${data.NOMOR_DOKUMEN || '-'}<br/>${data.KOTA_KANTOR_CABANG || ''}, ${data.TANGGAL_DOKUMEN || ''}</p>
      
      <p>Kepada Yth.<br/>
      ${data.NAMA_PJ_FASKES || 'Penanggung Jawab'}<br/>
      ${data.NAMA_FASKES || 'Faskes'}<br/>
      ${data.ALAMAT_FASKES || ''}<br/>
      ${data.KOTA_FASKES || ''}</p>
      
      <p style="margin-top:20px;">${data.NARASI || '[Isi narasi di sini]'}</p>
      
      ${data.DEADLINE ? `<p>Mohon dilakukan perbaikan dalam waktu <strong>${data.DEADLINE}</strong> hari sejak surat ini diterima.</p>` : ''}
      
      <p>Demikian surat ini disampaikan untuk menjadi perhatian.</p>
      
      <div style="margin-top:60px;display:flex;justify-content:space-between;">
        <div style="text-align:center;">
          <div style="border-bottom:1px solid #000;width:200px;height:60px;margin-bottom:4px;"></div>
          <div style="font-weight:600;">${data.NAMA_KANTOR_CABANG || 'BPJS Ketenagakerjaan'}</div>
          <div style="font-size:11px;color:#666;">(Tanda tangan basah)</div>
        </div>
        <div style="text-align:center;">
          <div style="border-bottom:1px solid #000;width:200px;height:60px;margin-bottom:4px;"></div>
          <div style="font-weight:600;">${data.NAMA_FASKES || 'Faskes'}</div>
          <div style="font-size:11px;color:#666;">(Tanda tangan basah)</div>
        </div>
      </div>
    </div>
  `
}
