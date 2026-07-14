import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'
import { ROLE_LABELS } from '@/lib/auth-constants'

// GET: Kartu Mutasi A4 (surat keterangan mutasi antar cabang)
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const { searchParams } = new URL(req.url)
    const mutasi_id = searchParams.get('mutasi_id')
    
    if (!mutasi_id) {
      return NextResponse.json({ error: 'mutasi_id wajib' }, { status: 400 })
    }
    
    // Get mutasi detail (tanpa join wpa_users karena FK ambigu)
    const { data: mutasi, error } = await supabaseAdmin
      .from('wpa_user_mutasi')
      .select(`
        *,
        from_kantor:wpa_kantor_cabang!wpa_user_mutasi_from_kantor_cabang_id_fkey(nama, kode, alamat, kota),
        to_kantor:wpa_kantor_cabang!wpa_user_mutasi_to_kantor_cabang_id_fkey(nama, kode, alamat, kota)
      `)
      .eq('id', mutasi_id)
      .single()
    
    if (error || !mutasi) {
      return NextResponse.json({ error: 'Mutasi tidak ditemukan' }, { status: 404 })
    }
    
    // Fetch user info separately
    const { data: userData } = await supabaseAdmin
      .from('wpa_users')
      .select('email, full_name, role, nip, phone')
      .eq('id', mutasi.user_id)
      .single()
    
    // Inject user data
    mutasi.wpa_users = userData
    
    // admin_kantor hanya bisa print mutasi yang melibatkan cabangnya
    if (me.role === 'admin_kantor' && me.kantor_cabang_id) {
      if (mutasi.from_kantor_cabang_id !== me.kantor_cabang_id && mutasi.to_kantor_cabang_id !== me.kantor_cabang_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    
    const user = mutasi.wpa_users || {}
    const fromKantor = mutasi.from_kantor || {}
    const toKantor = mutasi.to_kantor || {}
    const isApplied = mutasi.status === 'active'
    
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Surat Keterangan Mutasi — ${user.full_name}</title>
<style>
  @page { size: A4 portrait; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Times New Roman', serif; 
    background: #f5f5f5;
    color: #1f2937;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc {
    background: white;
    width: 170mm;
    min-height: 257mm;
    margin: 5mm auto;
    padding: 18mm;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    page-break-after: always;
  }
  .kop {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 14px;
    border-bottom: 3px double #1e40af;
    margin-bottom: 24px;
  }
  .kop-logo {
    width: 70px; height: 70px;
    background: linear-gradient(135deg, #1e40af, #0f766e);
    color: white;
    font-weight: 900;
    font-size: 16px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
  }
  .kop-text { flex: 1; text-align: center; }
  .kop-text h1 { font-size: 16px; color: #1e3a8a; margin-bottom: 2px; }
  .kop-text h2 { font-size: 14px; color: #1e3a8a; margin-bottom: 4px; }
  .kop-text p { font-size: 11px; color: #4b5563; line-height: 1.4; }
  .doc-title {
    text-align: center;
    margin-bottom: 20px;
  }
  .doc-title h2 { 
    font-size: 14px; 
    text-decoration: underline; 
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .doc-title p { font-size: 11px; color: #6b7280; }
  .status-badge {
    display: inline-block;
    padding: 4px 12px;
    background: ${isApplied ? '#dcfce7' : '#fef3c7'};
    color: ${isApplied ? '#166534' : '#92400e'};
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
    margin-top: 4px;
  }
  .body-text {
    font-size: 12px;
    line-height: 1.6;
    margin-bottom: 16px;
    text-align: justify;
  }
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 11px;
  }
  .info-table td {
    padding: 6px 8px;
    border: 1px solid #d1d5db;
    vertical-align: top;
  }
  .info-table td:first-child {
    width: 35%;
    background: #f3f4f6;
    font-weight: 600;
    color: #374151;
  }
  .arrow-block {
    text-align: center;
    margin: 14px 0;
    padding: 12px;
    background: #f0f9ff;
    border-radius: 6px;
  }
  .arrow-block .from-to {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    font-size: 13px;
    font-weight: 600;
  }
  .arrow-block .arrow { 
    color: #1e40af; 
    font-size: 22px; 
  }
  .arrow-block .from { color: #dc2626; }
  .arrow-block .to { color: #16a34a; }
  .signature-block {
    display: flex;
    justify-content: space-between;
    margin-top: 36px;
    font-size: 11px;
  }
  .signature-col {
    text-align: center;
    width: 45%;
  }
  .signature-col .label { margin-bottom: 60px; }
  .signature-col .name { font-weight: 600; text-decoration: underline; }
  .footer-note {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px dashed #d1d5db;
    font-size: 9px;
    color: #9ca3af;
    text-align: center;
  }
  @media print {
    body { background: white; }
    .doc { box-shadow: none; margin: 0; }
  }
</style>
</head>
<body>
<div class="doc">
  <div class="kop">
    <div class="kop-logo">BPJS</div>
    <div class="kop-text">
      <h1>BPJS KETENAGAKERJAAN</h1>
      <h2>${fromKantor.nama || '-'}</h2>
      <p>${fromKantor.alamat || '-'}, ${fromKantor.kota || ''}<br/>
      Telepon: (021) 1234567 · Email: kantor@bpjsketenagakerjaan.go.id</p>
    </div>
  </div>
  
  <div class="doc-title">
    <h2>Surat Keterangan Mutasi Pegawai</h2>
    <p>Nomor: ${mutasi.nomor_sk || `MUT-${mutasi.id.substring(0, 8).toUpperCase()}`}</p>
    <div class="status-badge">${isApplied ? '✓ SUDAH DITERAPKAN' : '⏳ DIJADWALKAN'}</div>
  </div>
  
  <p class="body-text">
    Yang bertanda tangan di bawah ini, Kepala ${fromKantor.nama || '-'} BPJS Ketenagakerjaan, 
    menerangkan dengan sebenarnya bahwa:
  </p>
  
  <table class="info-table">
    <tr><td>Nama Lengkap</td><td>: <strong>${user.full_name}</strong></td></tr>
    <tr><td>NIP</td><td>: ${user.nip || '-'}</td></tr>
    <tr><td>Jabatan / Role</td><td>: ${ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}</td></tr>
    <tr><td>Email</td><td>: ${user.email}</td></tr>
    <tr><td>No. Telepon</td><td>: ${user.phone || '-'}</td></tr>
  </table>
  
  <p class="body-text">
    Berdasarkan Surat Keputusan (SK) tanggal <strong>${new Date(mutasi.tanggal_sk).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>,
    yang bersangkutan telah dimutasi dari kedudukan di kantor cabang:
  </p>
  
  <div class="arrow-block">
    <div class="from-to">
      <div class="from">${fromKantor.nama || '-'}</div>
      <div class="arrow">→</div>
      <div class="to">${toKantor.nama || '-'}</div>
    </div>
  </div>
  
  <table class="info-table">
    <tr><td>Tanggal Efektif</td><td>: <strong>${new Date(mutasi.tanggal_efektif).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></td></tr>
    <tr><td>Nomor SK</td><td>: ${mutasi.nomor_sk || '-'}</td></tr>
    <tr><td>Alasan Mutasi</td><td>: ${mutasi.alasan || 'Rotasi pegawai antar cabang'}</td></tr>
    ${mutasi.processed_at ? `<tr><td>Tanggal Diterapkan</td><td>: ${new Date(mutasi.processed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>` : ''}
  </table>
  
  <p class="body-text">
    Surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya. 
    Demikian surat keterangan ini dibuat dengan sebenarnya.
  </p>
  
  <div class="signature-block">
    <div class="signature-col">
      <div class="label">Mengetahui,<br/>Kepala ${fromKantor.nama || '-'}</div>
      <div class="name">${me.full_name}</div>
    </div>
    <div class="signature-col">
      <div class="label">${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>Pegawai yang Dimutasi</div>
      <div class="name">${user.full_name}</div>
    </div>
  </div>
  
  <div class="footer-note">
    WPA — Workforce PKS Application BPJS Ketenagakerjaan | Dokumen ini dicetak pada ${new Date().toLocaleString('id-ID')}
  </div>
</div>
<script>
  window.onload = () => { setTimeout(() => window.print(), 500); };
</script>
</body>
</html>`
    
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
