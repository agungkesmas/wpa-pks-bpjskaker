/**
 * Upload pks_template_bersih.docx ke Supabase Storage
 * ===================================================
 *
 * Jalankan: npx tsx scripts/upload_template_to_supabase.ts
 *
 * Prereq:
 * - Set env vars di .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://hfhvsiuebrwrqmqzsroc.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
 *
 * - File template ada di: templates/pks_template_bersih.docx
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing env vars:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? '✓ (redacted)' : '✗')
  console.error('\nSet di .env.local lalu jalankan ulang.')
  process.exit(1)
}

const SUPABASE_URL_STR: string = SUPABASE_URL
const SUPABASE_KEY_STR: string = SUPABASE_KEY

const TEMPLATE_PATH = resolve(process.cwd(), 'templates/pks_template_bersih.docx')
const STORAGE_BUCKET = 'wpa-templates'
const STORAGE_PATH = 'templates/pks_template_bersih.docx'

async function main() {
  console.log('📦 Upload Template ke Supabase Storage')
  console.log('======================================')
  console.log('Supabase URL:', SUPABASE_URL_STR)
  console.log('Bucket:', STORAGE_BUCKET)
  console.log('Storage path:', STORAGE_PATH)
  console.log('Local file:', TEMPLATE_PATH)
  console.log('')

  const supabase = createClient(SUPABASE_URL_STR, SUPABASE_KEY_STR, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // 1. Cek apakah bucket ada, kalau tidak buat
  console.log('1. Cek bucket...')
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets()
  if (bErr) {
    console.error('❌ Gagal list buckets:', bErr.message)
    process.exit(1)
  }

  const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET)
  if (!bucketExists) {
    console.log(`   Bucket "${STORAGE_BUCKET}" tidak ada. Membuat...`)
    const { error: createErr } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: 10485760, // 10MB
    })
    if (createErr) {
      console.error('❌ Gagal create bucket:', createErr.message)
      process.exit(1)
    }
    console.log('   ✅ Bucket created')
  } else {
    console.log('   ✅ Bucket sudah ada')
  }

  // 2. Baca file
  console.log('\n2. Baca file template...')
  let fileBytes: Buffer
  try {
    fileBytes = readFileSync(TEMPLATE_PATH)
    console.log(`   ✅ File dibaca: ${fileBytes.length} bytes`)
  } catch (e: any) {
    console.error('❌ Gagal baca file:', e.message)
    console.error('   Pastikan file ada di:', TEMPLATE_PATH)
    process.exit(1)
  }

  // 3. Upload (overwrite kalau sudah ada)
  console.log('\n3. Upload file...')
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(STORAGE_PATH, fileBytes, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true, // overwrite kalau sudah ada
    })

  if (upErr) {
    console.error('❌ Gagal upload:', upErr.message)
    process.exit(1)
  }
  console.log('   ✅ Upload berhasil')

  // 4. Verify
  console.log('\n4. Verify upload...')
  const { data: fileList, error: listErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list('templates')
  if (listErr) {
    console.error('❌ Gagal list file:', listErr.message)
    process.exit(1)
  }

  const uploaded = fileList?.find(f => f.name === 'pks_template_bersih.docx')
  if (uploaded) {
    console.log(`   ✅ Verified: ${uploaded.name} (${uploaded.metadata?.size || '?'} bytes)`)
  } else {
    console.error('❌ File tidak ditemukan setelah upload')
    process.exit(1)
  }

  console.log('\n✅ DONE!')
  console.log('')
  console.log('Next step:')
  console.log('  1. Jalankan SQL migration: scripts/wpa_replace_template_with_mailmerge.sql')
  console.log('     di Supabase SQL Editor (untuk update DB record + 91 placeholders)')
  console.log('  2. Test endpoint: curl https://your-app.vercel.app/api/drafting/generate-docx')
  console.log('  3. Test generate: POST /api/drafting/generate-docx dengan body {data:{...}}')
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
