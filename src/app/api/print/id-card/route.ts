import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-constants'
import { ROLE_LABELS } from '@/lib/auth-constants'

// GET: render ID Card HTML untuk user tertentu (atau semua user di kantor)
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const kantor_cabang_id = searchParams.get('kantor_cabang_id')
    
    let users: any[] = []
    
    if (user_id) {
      // Single user
      if (user_id !== me.id && !isAdmin(me.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data, error } = await supabaseAdmin
        .from('wpa_users')
        .select(`
          id, email, full_name, role, phone, nip, profile_photo_url,
          wpa_kantor_cabang(nama, kode, alamat, kota, telp)
        `)
        .eq('id', user_id)
        .single()
      if (error || !data) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
      users = [data]
    } else if (kantor_cabang_id) {
      // All users in kantor
      if (!isAdmin(me.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (me.role === 'admin_kantor' && me.kantor_cabang_id !== kantor_cabang_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data, error } = await supabaseAdmin
        .from('wpa_users')
        .select(`
          id, email, full_name, role, phone, nip, profile_photo_url,
          wpa_kantor_cabang(nama, kode, alamat, kota, telp)
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
    
    // Render HTML ID Card (landscape A6, untuk print plastik)
    const cards = users.map(u => {
      const kantor = u.wpa_kantor_cabang || {}
      const initials = (u.full_name || '?').split(' ').map(w => w.charAt(0)).slice(0,2).join('').toUpperCase()
      return `
        <div class="id-card">
          <div class="id-card-front">
            <div class="header">
              <div class="logo">BPJS</div>
              <div class="brand">
                <div class="brand-name">BPJS KETENAGAKERJAAN</div>
                <div class="brand-sub">WPA — PKS Management</div>
              </div>
            </div>
            <div class="body">
              <div class="photo">
                ${u.profile_photo_url 
                  ? `<img src="${u.profile_photo_url}" alt="photo" />`
                  : `<div class="photo-placeholder">${initials}</div>`}
              </div>
              <div class="info">
                <div class="name">${u.full_name}</div>
                <div class="role">${ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}</div>
                <div class="detail"><span>NIP:</span> ${u.nip || '-'}</div>
                <div class="detail"><span>Email:</span> ${u.email}</div>
                <div class="detail"><span>Kantor:</span> ${kantor.nama || '-'}</div>
                <div class="detail"><span>HP:</span> ${u.phone || '-'}</div>
              </div>
            </div>
            <div class="footer">
              <div class="footer-left">${kantor.kode || '-'}</div>
              <div class="footer-right">Berlaku selama menjadi pegawai aktif</div>
            </div>
          </div>
        </div>
      `
    }).join('')
    
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>ID Card — ${users.length} user</title>
<style>
  @page { size: A6 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Arial', sans-serif; 
    background: #f5f5f5; 
    padding: 10px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .id-card {
    width: 148mm;
    height: 105mm;
    margin: 5mm auto;
    background: white;
    border: 2px solid #1e40af;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .id-card:last-child { page-break-after: auto; }
  .header {
    background: linear-gradient(135deg, #1e40af 0%, #0f766e 100%);
    color: white;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo {
    width: 32px;
    height: 32px;
    background: white;
    color: #1e40af;
    font-weight: 900;
    font-size: 10px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .brand-name { font-size: 11px; font-weight: 700; line-height: 1.2; }
  .brand-sub { font-size: 8px; opacity: 0.85; }
  .body { 
    flex: 1; 
    display: flex; 
    gap: 12px; 
    padding: 10px 14px;
    align-items: center;
  }
  .photo { 
    width: 80px; 
    height: 100px; 
    border: 2px solid #1e40af;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    background: #e0e7ff;
  }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .photo-placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
    font-weight: 700;
    color: #1e40af;
  }
  .info { flex: 1; }
  .name { font-size: 14px; font-weight: 700; color: #1e3a8a; margin-bottom: 2px; }
  .role { font-size: 11px; color: #0f766e; font-weight: 600; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
  .detail { font-size: 9px; color: #374151; margin: 2px 0; }
  .detail span { color: #6b7280; font-weight: 600; display: inline-block; width: 50px; }
  .footer { 
    background: #f1f5f9;
    padding: 5px 12px;
    font-size: 8px;
    color: #64748b;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #cbd5e1;
  }
  @media print {
    body { background: white; padding: 0; }
    .id-card { box-shadow: none; margin: 0; }
  }
</style>
</head>
<body>
${cards}
<script>
  window.onload = () => { window.print(); };
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
