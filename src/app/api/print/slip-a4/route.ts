import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'
import { ROLE_LABELS } from '@/lib/auth-constants'

// GET: Slip A4 untuk onboarding user (detail login + instruksi)
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const kantor_cabang_id = searchParams.get('kantor_cabang_id')
    
    let users: any[] = []
    
    if (user_id) {
      if (user_id !== me.id && !isAdmin(me.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data, error } = await supabaseAdmin
        .from('wpa_users')
        .select(`
          id, email, full_name, role, phone, nip, temp_password, must_change_password, created_at,
          wpa_kantor_cabang(nama, kode, alamat, kota, telp, email)
        `)
        .eq('id', user_id)
        .single()
      if (error || !data) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
      users = [data]
    } else if (kantor_cabang_id) {
      if (!isAdmin(me.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if ((me.role as string) === 'admin_kantor' && me.kantor_cabang_id !== kantor_cabang_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data, error } = await supabaseAdmin
        .from('wpa_users')
        .select(`
          id, email, full_name, role, phone, nip, temp_password, must_change_password, created_at,
          wpa_kantor_cabang(nama, kode, alamat, kota, telp, email)
        `)
        .eq('kantor_cabang_id', kantor_cabang_id)
        .eq('is_active', true)
        .order('role')
        .order('full_name')
      if (error) throw error
      users = data || []
    } else {
      return NextResponse.json({ error: 'user_id atau kantor_cabang_id wajib' }, { status: 400 })
    }
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'Tidak ada user untuk dicetak' }, { status: 404 })
    }
    
    const slips = users.map(u => {
      const kantor = u.wpa_kantor_cabang || {}
      const pwdDisplay = u.temp_password || '(lihat admin / reset password)'
      return `
        <div class="slip">
          <div class="header">
            <div class="logo">BPJS</div>
            <div class="brand">
              <div class="brand-name">BPJS KETENAGAKERJAAN</div>
              <div class="brand-sub">Mitra PLKK — BPJS Ketenagakerjaan</div>
            </div>
            <div class="doc-meta">
              <div>Slip Akun Pengguna</div>
              <div class="date">${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
          
          <div class="content">
            <h2 class="title">Selamat Datang, ${u.full_name}!</h2>
            <p class="subtitle">Berikut detail akun Anda untuk mengakses aplikasi Mitra PLKK:</p>
            
            <table class="info-table">
              <tr><td>Nama Lengkap</td><td>: <strong>${u.full_name}</strong></td></tr>
              <tr><td>NIP</td><td>: ${u.nip || '-'}</td></tr>
              <tr><td>Role</td><td>: <strong>${ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}</strong></td></tr>
              <tr><td>Kantor Cabang</td><td>: ${kantor.nama || '-'}</td></tr>
              <tr><td>Alamat Kantor</td><td>: ${kantor.alamat || '-'}, ${kantor.kota || ''}</td></tr>
              <tr><td>Email Login</td><td>: <strong>${u.email}</strong></td></tr>
              <tr><td>Password Sementara</td><td>: <strong class="pwd">${pwdDisplay}</strong></td></tr>
              ${u.phone ? `<tr><td>No. HP</td><td>: ${u.phone}</td></tr>` : ''}
            </table>
            
            <div class="instructions">
              <h3>Instruksi Login:</h3>
              <ol>
                <li>Buka aplikasi Mitra PLKK di <strong>https://mitra-plkk.vercel.app</strong></li>
                <li>Masukkan <strong>Email</strong> dan <strong>Password Sementara</strong> di atas</li>
                <li>Setelah login, segera ubah password Anda via menu <strong>Profil Saya → Ubah Password</strong></li>
                <li>Password baru minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka</li>
                <li>Untuk bantuan, hubungi Admin Kantor Cabang Anda</li>
              </ol>
            </div>
            
            <div class="footer-note">
              <p>⚠️ <strong>PENTING:</strong> Jangan bagikan password ke pihak yang tidak berwenang. Password sementara hanya untuk login pertama. Sistem akan mencatat semua aktivitas login untuk audit keamanan.</p>
            </div>
            
            <div class="signature">
              <div>Diterbitkan oleh: ${me.full_name}</div>
              <div>Tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
          
          <div class="page-footer">
            Mitra PLKK — BPJS Ketenagakerjaan | Halaman 1 dari 1
          </div>
        </div>
      `
    }).join('')
    
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Slip Akun — ${users.length} user</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Arial', sans-serif; 
    background: #f5f5f5; 
    color: #1f2937;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .slip {
    background: white;
    width: 186mm;
    min-height: 273mm;
    margin: 5mm auto;
    padding: 12mm;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .slip:last-child { page-break-after: auto; }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 3px solid #1e40af;
    margin-bottom: 18px;
  }
  .logo {
    width: 50px; height: 50px;
    background: linear-gradient(135deg, #1e40af, #0f766e);
    color: white;
    font-weight: 900;
    font-size: 14px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
  }
  .brand { flex: 1; }
  .brand-name { font-size: 14px; font-weight: 700; color: #1e3a8a; }
  .brand-sub { font-size: 10px; color: #6b7280; }
  .doc-meta { text-align: right; font-size: 10px; color: #6b7280; }
  .doc-meta > div:first-child { font-weight: 600; color: #1e40af; }
  .content { flex: 1; }
  .title { font-size: 18px; color: #1e3a8a; margin-bottom: 4px; }
  .subtitle { font-size: 11px; color: #6b7280; margin-bottom: 16px; }
  .info-table {
    width: 100%;
    font-size: 11px;
    margin-bottom: 18px;
    border-collapse: collapse;
  }
  .info-table td { padding: 4px 8px; vertical-align: top; }
  .info-table td:first-child { width: 140px; color: #6b7280; font-weight: 600; }
  .pwd {
    background: #fef3c7;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    color: #92400e;
  }
  .instructions {
    background: #f0f9ff;
    border-left: 4px solid #0284c7;
    padding: 12px 16px;
    margin-bottom: 18px;
    border-radius: 4px;
  }
  .instructions h3 { font-size: 12px; color: #0c4a6e; margin-bottom: 8px; }
  .instructions ol { padding-left: 20px; }
  .instructions li { font-size: 10px; margin: 4px 0; line-height: 1.5; }
  .footer-note {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 18px;
  }
  .footer-note p { font-size: 10px; color: #991b1b; line-height: 1.5; }
  .signature {
    text-align: right;
    font-size: 10px;
    color: #6b7280;
    margin-top: 24px;
  }
  .page-footer {
    text-align: center;
    font-size: 9px;
    color: #9ca3af;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }
  @media print {
    body { background: white; }
    .slip { box-shadow: none; margin: 0; }
  }
</style>
</head>
<body>
${slips}
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
