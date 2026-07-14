// Seed: kantor cabang Cirebon + admin + RS Juanda Kuningan + PIC RS + Legal RS
// Jalankan: bun /home/z/my-project/scripts/seed_cirebon_juanda.ts
//
// Password menggunakan bcrypt 12 rounds (sama dengan yang dipakai aplikasi).
// Setelah seeding, password ditampilkan ke layar — simpan baik-baik.

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

interface Account {
  role: 'admin_kantor' | 'case_manager' | 'kepala_bidang' | 'pic_rs' | 'legal_rs'
  email: string
  password: string
  full_name: string
  phone: string
  kantor_cabang_kode?: string
  faskes_nama?: string
}

const accounts: Account[] = [
  // Kantor Cabang Cirebon — admin
  {
    role: 'admin_kantor',
    email: 'admin.cirebon@wpa.local',
    password: process.env.SEED_ADMIN_CIREBON_PWD || 'CHANGE_ME_IN_ENV',
    full_name: 'Administrator Kantor Cabang Cirebon',
    phone: '0231-123456',
    kantor_cabang_kode: 'KC-CIREBON',
  },
  // Kantor Cabang Cirebon — Case Manager
  {
    role: 'case_manager',
    email: 'cm.cirebon@wpa.local',
    password: process.env.SEED_CM_CIREBON_PWD || 'CHANGE_ME_IN_ENV',
    full_name: 'Siti Nurhaliza, SKM',
    phone: '0231-234567',
    kantor_cabang_kode: 'KC-CIREBON',
  },
  // Kantor Cabang Cirebon — Kepala Bidang Pelayanan
  {
    role: 'kepala_bidang',
    email: 'kabid.cirebon@wpa.local',
    password: process.env.SEED_KABID_CIREBON_PWD || 'CHANGE_ME_IN_ENV',
    full_name: 'Drs. H. Suparman, M.Si',
    phone: '0231-345678',
    kantor_cabang_kode: 'KC-CIREBON',
  },
  // RS Juanda Kuningan — PIC RS dan Legal RS
  {
    role: 'pic_rs',
    email: 'pic.rsjuanda@wpa.local',
    password: process.env.SEED_PIC_RSJUANDA_PWD || 'CHANGE_ME_IN_ENV',
    full_name: 'Dr. Andi Wijaya, SpOT',
    phone: '081234567801',
    faskes_nama: 'RS Juanda Kuningan',
  },
  {
    role: 'legal_rs',
    email: 'legal.rsjuanda@wpa.local',
    password: process.env.SEED_LEGAL_RSJUANDA_PWD || 'CHANGE_ME_IN_ENV',
    full_name: 'Rina Marlina, SH',
    phone: '081234567802',
    faskes_nama: 'RS Juanda Kuningan',
  },
]

async function seed() {
  console.log('=== SEEDING WPA DATA ===\n')

  // 1. Create kantor cabang Cirebon (idempotent)
  console.log('1. Create kantor cabang Cirebon...')
  const { data: existingCirebon } = await supabase
    .from('wpa_kantor_cabang')
    .select('id, kode')
    .eq('kode', 'KC-CIREBON')
    .maybeSingle()

  let cirebonId: string
  if (existingCirebon) {
    cirebonId = existingCirebon.id
    console.log(`   ✓ Already exists: ${cirebonId}`)
  } else {
    const { data, error } = await supabase
      .from('wpa_kantor_cabang')
      .insert({
        kode: 'KC-CIREBON',
        nama: 'BPJS Ketenagakerjaan Cabang Cirebon',
        alamat: 'Jl. Sisingamangaraja No. 1, Cirebon',
        kota: 'Cirebon',
        provinsi: 'Jawa Barat',
        telp: '0231-123456',
        email: 'cirebon@bpjsketenagakerjaan.go.id',
        is_active: true,
      })
      .select('id, kode')
      .single()
    if (error) throw error
    cirebonId = data.id
    console.log(`   ✓ Created: ${cirebonId}`)
  }

  // 2. Create faskes RS Juanda Kuningan (idempotent)
  console.log('\n2. Create faskes RS Juanda Kuningan...')
  const { data: existingRs } = await supabase
    .from('wpa_faskes')
    .select('id, nama, status')
    .eq('nama', 'RS Juanda Kuningan')
    .maybeSingle()

  let rsId: string
  if (existingRs) {
    rsId = existingRs.id
    console.log(`   ✓ Already exists: ${rsId} (status: ${existingRs.status})`)
  } else {
    const { data, error } = await supabase
      .from('wpa_faskes')
      .insert({
        kode: 'RS-JUANDA-KNG',
        nama: 'RS Juanda Kuningan',
        jenis: 'RS',
        bentuk: 'Rumah Sakit Swasta',
        alamat: 'Jl. Raya Kuningan No. 12, Kuningan, Jawa Barat',
        kota: 'Kuningan',
        provinsi: 'Jawa Barat',
        telp: '0232-875000',
        email: 'info@rsjuanda.co.id',
        npwp: '01.234.567.8-901.000',
        penanggung_jawab_nama: 'Dr. Andi Wijaya, SpOT',
        penanggung_jawab_jabatan: 'Direktur',
        penanggung_jawab_phone: '081234567801',
        bank_name: 'Bank BRI',
        bank_cabang: 'Kuningan',
        bank_rekening_number: '0123-01-012345-78-9',
        bank_rekening_name: 'RS Juanda Kuningan',
        status: 'aktif', // langsung aktif agar bisa dipakai
        kantor_cabang_id: cirebonId,
      })
      .select('id, nama')
      .single()
    if (error) throw error
    rsId = data.id
    console.log(`   ✓ Created: ${rsId}`)
  }

  // 3. Create users
  console.log('\n3. Create users...')
  const createdAccounts: any[] = []

  for (const acc of accounts) {
    // Check existing
    const { data: existing } = await supabase
      .from('wpa_users')
      .select('id, email, role, is_active')
      .eq('email', acc.email)
      .maybeSingle()

    let userId: string
    if (existing) {
      userId = existing.id
      console.log(`   ✓ ${acc.email} already exists (id: ${userId}, role: ${existing.role})`)
      // Update password hash to ensure known password
      const hash = bcrypt.hashSync(acc.password, 12)
      await supabase
        .from('wpa_users')
        .update({ password_hash: hash, is_active: true, full_name: acc.full_name })
        .eq('id', userId)
      console.log(`     ↳ Password updated to known value`)
    } else {
      const hash = bcrypt.hashSync(acc.password, 12)
      const insertData: any = {
        email: acc.email.toLowerCase(),
        password_hash: hash,
        full_name: acc.full_name,
        role: acc.role,
        phone: acc.phone,
        is_active: true,
        created_by: null,
      }
      if (acc.kantor_cabang_kode === 'KC-CIREBON') {
        insertData.kantor_cabang_id = cirebonId
      }
      if (acc.faskes_nama === 'RS Juanda Kuningan') {
        insertData.faskes_id = rsId
        // PIC RS & Legal RS juga diasosiasikan ke kantor cabang Cirebon (sebagai tenant)
        insertData.kantor_cabang_id = cirebonId
      }

      const { data, error } = await supabase
        .from('wpa_users')
        .insert(insertData)
        .select('id, email, role, full_name')
        .single()
      if (error) {
        console.error(`   ✗ Error creating ${acc.email}:`, error.message)
        continue
      }
      userId = data.id
      console.log(`   ✓ Created: ${acc.email} (role: ${acc.role}, id: ${userId})`)
    }

    createdAccounts.push({ ...acc, id: userId })
  }

  // 4. Print summary
  console.log('\n=== SEEDING COMPLETE ===\n')
  console.log('KANTOR CABANG:')
  console.log(`  • KC-CIREBON — BPJS Ketenagakerjaan Cabang Cirebon (id: ${cirebonId})`)
  console.log('')
  console.log('FASKES:')
  console.log(`  • RS Juanda Kuningan — aktif (id: ${rsId})`)
  console.log('')
  console.log('AKUN YANG DIBUAT (password dibaca dari env var SEED_*_PWD):')
  console.log('')
  for (const acc of accounts) {
    console.log(`  • ${acc.email} (${acc.role}) — pwd from env var`)
  }
  console.log('')
  console.log('⚠️  Password tidak dicetak ke layar demi keamanan.')
  console.log('   Pastikan env var SEED_ADMIN_CIREBON_PWD, SEED_PIC_RSJUANDA_PWD,')
  console.log('   SEED_LEGAL_RSJUANDA_PWD sudah di-set sebelum menjalankan script ini.')
}

seed().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
