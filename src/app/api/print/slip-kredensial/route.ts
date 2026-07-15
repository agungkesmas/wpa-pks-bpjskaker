import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/auth-constants'

export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const user_ids = searchParams.get('user_ids')  // comma-separated for batch
    const kantor_cabang_id = searchParams.get('kantor_cabang_id')

    let users: any[] = []

    if (user_ids) {
      // Batch mode: multiple user IDs
      if (!['super_admin', 'kepala_bidang'].includes(me.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const ids = user_ids.split(',').map(s => s.trim()).filter(Boolean)
      if (ids.length === 0) return NextResponse.json({ error: 'user_ids tidak valid' }, { status: 400 })
      if (ids.length > 100) return NextResponse.json({ error: 'Maksimal 100 user per print' }, { status: 400 })

      const { data, error } = await supabaseAdmin
        .from('wpa_users')
        .select('id, email, full_name, role, phone, nip, temp_password, must_change_password, wpa_kantor_cabang(nama)')
        .in('id', ids)
        .order('full_name')
      if (error) throw error
      users = data || []
    } else if (user_id) {
      const { data, error } = await supabaseAdmin
        .from('wpa_users')
        .select('id, email, full_name, role, phone, nip, temp_password, must_change_password, wpa_kantor_cabang(nama)')
        .eq('id', user_id)
        .single()
      if (error || !data) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
      users = [data]
    } else if (kantor_cabang_id) {
      if (!['super_admin', 'kepala_bidang'].includes(me.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data, error } = await supabaseAdmin
        .from('wpa_users')
        .select('id, email, full_name, role, phone, nip, temp_password, must_change_password, wpa_kantor_cabang(nama)')
        .eq('kantor_cabang_id', kantor_cabang_id)
        .eq('is_active', true)
        .order('role').order('full_name')
      if (error) throw error
      users = data || []
    } else {
      return NextResponse.json({ error: 'user_id, user_ids, atau kantor_cabang_id wajib' }, { status: 400 })
    }
    
    if (users.length === 0) return NextResponse.json({ error: 'Tidak ada user' }, { status: 404 })
    
    const LOGIN_URL = 'https://mitra-plkk.vercel.app'
    
    const cards = users.map(u => {
      const kantor = u.wpa_kantor_cabang?.nama || '-'
      const pwd = u.temp_password || '(sudah diganti)'
      const roleLabel = ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role
      const warn = u.must_change_password ? `<div class="warn">⚠ Password sementara — segera ganti setelah login pertama.</div>` : ''
      
      return `
        <div class="card">
          <div class="hdr">
            <div class="logo">⚡</div>
            <div><div class="brand">Mitra PLKK</div><div class="sub">BPJS Ketenagakerjaan</div></div>
            <div class="tag">Slip Kredensial</div>
          </div>
          <div class="body">
            <div class="row"><span>Nama</span><b>${u.full_name}</b></div>
            <div class="row"><span>Role</span><b>${roleLabel}</b></div>
            <div class="row"><span>Kantor</span><b>${kantor}</b></div>
            <div class="row"><span>NIP</span><b>${u.nip || '-'}</b></div>
            <div class="row"><span>HP</span><b>${u.phone || '-'}</b></div>
            <div class="div"></div>
            <div class="row"><span>Email / Username</span><b class="mono">${u.email}</b></div>
            <div class="row"><span>Password</span><b class="mono pwd">${pwd}</b></div>
            <div class="row"><span>Login di</span><b class="mono url">${LOGIN_URL}</b></div>
            ${warn}
            <div class="note">Simpan kredensial ini dengan aman. Jangan bagikan ke orang lain.</div>
          </div>
        </div>`
    }).join('')
    
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Slip Kredensial — Mitra PLKK</title>
<style>
@page{size:A4;margin:10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f0f0;padding:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.card{width:180mm;min-height:90mm;margin:5mm auto;background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);page-break-after:always}
.card:last-child{page-break-after:auto}
.hdr{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#1e40af;color:#fff}
.logo{font-size:20px}
.brand{font-size:14px;font-weight:700}
.sub{font-size:10px;opacity:.8}
.tag{margin-left:auto;font-size:11px;opacity:.9}
.body{padding:16px}
.row{display:flex;align-items:baseline;padding:3px 0;font-size:12px}
.row span{width:140px;color:#6b7280}
.row b{color:#1f2937}
.mono{font-family:'Courier New',monospace}
.pwd{background:#fef3c7;padding:1px 6px;border-radius:3px;color:#92400e;font-size:13px}
.url{color:#2563eb;font-size:11px}
.div{height:1px;background:#e5e7eb;margin:10px 0}
.warn{margin-top:8px;padding:6px 10px;background:#fef3c7;border:1px solid #fde68a;border-radius:4px;font-size:10px;color:#92400e}
.note{margin-top:10px;padding:6px 10px;background:#f0f9ff;border-left:3px solid #0284c7;border-radius:0 4px 4px 0;font-size:10px;color:#0c4a6e}
@media print{body{background:#fff;padding:0}.card{box-shadow:none;margin:0}}
</style></head><body>
${cards}
<script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
</body></html>`
    
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
