/**
 * Next.js API Route: /api/drafting/generate-google-doc
 *
 * Stub implementation — copy ke src/app/api/drafting/generate-google-doc/route.ts
 * Setelah Apps Script di-deploy dan env vars di-set.
 *
 * Flow:
 * 1. PIC RS isi form 81 placeholder di DraftingPKSView
 * 2. Klik "Generate ke Google Docs"
 * 3. Frontend call endpoint ini
 * 4. Endpoint call Apps Script Web App
 * 5. Apps Script clone template + replace placeholder + share ke PIC RS + CM
 * 6. Return edit_url ke frontend
 * 7. Frontend save google_doc_id + google_doc_url ke DB (via endpoint ini juga)
 * 8. PIC RS klik "Buka di Google Docs" → edit → "Submit untuk Review"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_WEB_APP_URL!
const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET || ''

interface GenerateDocPayload {
  pipeline_id: string
  values: Record<string, string | number | null>
  doc_name?: string
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (!['pic_rs', 'case_manager', 'super_admin'].includes(session.role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    // 2. Validate payload
    const body: GenerateDocPayload = await req.json()
    const { pipeline_id, values, doc_name } = body
    if (!pipeline_id || !values) {
      return NextResponse.json({ ok: false, error: 'Missing pipeline_id or values' }, { status: 400 })
    }

    // 3. Get pipeline detail
    const { data: pipeline, error: pErr } = await supabaseAdmin
      .from('wpa_pipeline')
      .select(`
        id,
        jenis_pipeline,
        faskes_id,
        kantor_cabang_id,
        initiated_by,
        template_id,
        current_tahap,
        wpa_pks_template (
          id,
          google_doc_template_id,
          file_docx_path
        ),
        wpa_faskes (
          id,
          nama
        )
      `)
      .eq('id', pipeline_id)
      .single()
    if (pErr || !pipeline) {
      return NextResponse.json({ ok: false, error: 'Pipeline tidak ditemukan' }, { status: 404 })
    }

    // 4. Verify tahap (hanya bisa generate saat drafting_pks / drafting_adendum)
    if (!['drafting_pks', 'drafting_adendum'].includes(pipeline.current_tahap)) {
      return NextResponse.json({
        ok: false,
        error: `Tidak bisa generate dokumen di tahap ${pipeline.current_tahap}. Hanya bisa di tahap drafting.`
      }, { status: 400 })
    }

    // 5. Verify template punya google_doc_template_id
    const template = pipeline.wpa_pks_template as any
    if (!template?.google_doc_template_id) {
      return NextResponse.json({
        ok: false,
        error: 'Template belum di-set untuk Google Docs. Hubungi Super Admin untuk upload template ke Google Docs dan set google_doc_template_id.'
      }, { status: 400 })
    }

    // 6. Get PIC RS + CM email untuk auto-share
    const [picRsEmail, cmEmail] = await Promise.all([
      getEmailByUserId(pipeline.initiated_by),
      getCmEmailByKantor(pipeline.kantor_cabang_id)
    ])

    const shareWith = [
      ...(picRsEmail ? [{ email: picRsEmail, role: 'writer' as const }] : []),
      ...(cmEmail ? [{ email: cmEmail, role: 'writer' as const }] : [])
    ]

    // 7. Prepare Apps Script payload
    const appsScriptPayload = {
      action: 'generate_doc',
      jenis_pipeline: pipeline.jenis_pipeline,
      values: values,
      doc_name: doc_name || `PKS - ${pipeline.wpa_faskes?.nama || 'Untitled'} - ${new Date().getFullYear()}`,
      share_with: shareWith
    }

    // 8. Call Apps Script (with HMAC signature kalau secret di-set)
    const bodyStr = JSON.stringify(appsScriptPayload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (APPS_SCRIPT_SECRET) {
      const signature = await hmacSha256Hex(bodyStr, APPS_SCRIPT_SECRET)
      headers['X-Signature'] = signature
      // Apps Script akan baca dari query string ?sig=...
    }

    const url = APPS_SCRIPT_SECRET
      ? `${APPS_SCRIPT_URL}?sig=${await hmacSha256Hex(bodyStr, APPS_SCRIPT_SECRET)}`
      : APPS_SCRIPT_URL

    const appsRes = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyStr,
      redirect: 'follow'  // Apps Script Web App sering 302 redirect
    })

    if (!appsRes.ok) {
      const errText = await appsRes.text()
      console.error('Apps Script call failed:', appsRes.status, errText)
      return NextResponse.json({
        ok: false,
        error: 'Apps Script error',
        details: errText.substring(0, 500)
      }, { status: 502 })
    }

    const appsResult = await appsRes.json()
    if (!appsResult.ok) {
      return NextResponse.json({
        ok: false,
        error: appsResult.error || 'Apps Script returned error',
        details: appsResult
      }, { status: 500 })
    }

    // 9. Save ke DB
    const { doc_id, edit_url, name, replaced, remaining_placeholders, shared } = appsResult

    // Save ke wpa_pipeline
    await supabaseAdmin
      .from('wpa_pipeline')
      .update({
        google_doc_id: doc_id,
        google_doc_url: edit_url,
        google_doc_shared_with: shared,
        data_jsonb: { ...values, _meta: { generated_at: new Date().toISOString() } },
        updated_at: new Date().toISOString()
      })
      .eq('id', pipeline_id)

    // Save ke wpa_pks (kalau sudah ada record pks-nya)
    const { data: pksRecord } = await supabaseAdmin
      .from('wpa_pks')
      .select('id')
      .eq('faskes_id', pipeline.faskes_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (pksRecord) {
      await supabaseAdmin
        .from('wpa_pks')
        .update({
          google_doc_id: doc_id,
          google_doc_url: edit_url,
          google_doc_shared_with: shared,
          data_jsonb: values,
          updated_at: new Date().toISOString()
        })
        .eq('id', pksRecord.id)
    }

    // Save ke wpa_pks_draft_versions (new version)
    const { data: lastVersion } = await supabaseAdmin
      .from('wpa_pks_draft_versions')
      .select('version')
      .eq('pipeline_id', pipeline_id)
      .order('version', { ascending: false })
      .limit(1)
      .single()
    const nextVersion = (lastVersion?.version || 0) + 1

    await supabaseAdmin
      .from('wpa_pks_draft_versions')
      .insert({
        pks_id: pksRecord?.id || null,
        pipeline_id: pipeline_id,
        version: nextVersion,
        google_doc_version_id: doc_id,
        review_status: 'pending',
        submitted_by: session.userId,
        submitted_at: new Date().toISOString()
      })

    // 10. Audit log
    await supabaseAdmin.from('wpa_audit_logs').insert({
      user_id: session.userId,
      kantor_cabang_id: pipeline.kantor_cabang_id,
      action: 'generate_google_doc',
      entity_type: 'pipeline',
      entity_id: pipeline_id,
      after_data: {
        doc_id,
        edit_url,
        name,
        replaced_count: Object.keys(replaced || {}).filter(k => replaced[k]).length,
        remaining_placeholders: remaining_placeholders || [],
        shared_with: shared
      },
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent')
    })

    // 11. Return ke frontend
    return NextResponse.json({
      ok: true,
      doc_id,
      edit_url,
      name,
      replaced,
      remaining_placeholders: remaining_placeholders || [],
      shared,
      version: nextVersion
    })

  } catch (err: any) {
    console.error('Generate Google Doc error:', err)
    return NextResponse.json({
      ok: false,
      error: err.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}


// ============================================================
// Helper: HMAC-SHA256 hex signature
// ============================================================
async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => ('0' + b.toString(16)).slice(-2))
    .join('')
}


// ============================================================
// Helper: get email by user_id
// ============================================================
async function getEmailByUserId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('wpa_users')
    .select('email')
    .eq('id', userId)
    .single()
  return data?.email || null
}


// ============================================================
// Helper: get CM email by kantor_cabang_id
// ============================================================
async function getCmEmailByKantor(kantorCabangId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('wpa_users')
    .select('email')
    .eq('kantor_cabang_id', kantorCabangId)
    .eq('role', 'case_manager')
    .eq('is_active', true)
    .limit(1)
    .single()
  return data?.email || null
}


// ============================================================
// GET endpoint — untuk health check
// ============================================================
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'generate-google-doc',
    apps_script_configured: !!APPS_SCRIPT_URL,
    secret_configured: !!APPS_SCRIPT_SECRET
  })
}
