import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

// ============================================================
// API: /api/drafting/generate-docx
// ============================================================
// Generate PKS .docx via Python mail merge.
//
// Strategy:
// - Vercel Next.js tidak support spawn('python3'). Jadi kita call
//   Python serverless function terpisah di /api/pks_merge (Vercel
//   auto-detect Python files in /api folder).
// - Python function pakai python-docx, returns binary .docx
// - Next.js route sebagai orchestrator: ambil data dari DB,
//   call Python function, return hasil ke client
//
// Output: binary .docx (download) atau JSON dengan stats
// ============================================================

const schema = z.object({
  pipeline_id: z.string().uuid().optional(),
  data: z.record(z.string(), z.any()).optional(),
  return_stats: z.boolean().optional().default(false),
})

// URL Python function (Vercel auto-deploy di /api/pks_merge)
const PYTHON_MERGE_URL = '/api/pks_merge'

export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.parse(body)

    // ============================================================
    // 1. Dapatkan data placeholder
    // ============================================================
    let data: Record<string, any> = {}
    let pipeline_id: string | undefined
    let pks_id: string | undefined
    let kantor_cabang_id: string | undefined

    if (parsed.pipeline_id) {
      pipeline_id = parsed.pipeline_id

      const { data: pipeline, error: pErr } = await supabaseAdmin
        .from('wpa_pipeline')
        .select(`
          id,
          jenis,
          faskes_id,
          kantor_cabang_id,
          current_tahap,
          initiated_by,
          pks_id,
          wpa_pks (
            id,
            data_jsonb,
            template_id
          )
        `)
        .eq('id', pipeline_id)
        .single()
      if (pErr || !pipeline) {
        return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })
      }

      const pks = (pipeline as any).wpa_pks
      if (!pks) {
        return NextResponse.json({ error: 'PKS belum di-draft. Simpan draft terlebih dahulu.' }, { status: 400 })
      }
      pks_id = pks.id
      kantor_cabang_id = pipeline.kantor_cabang_id

      data = { ...pks.data_jsonb }
      delete data.html_content
      delete data._meta
    } else if (parsed.data) {
      data = parsed.data
    } else {
      return NextResponse.json({
        error: 'Harus isi pipeline_id ATAU data'
      }, { status: 400 })
    }

    // ============================================================
    // 2. Call Python serverless function (/api/pks_merge)
    // ============================================================
    const pyRes = await fetch(`https://${req.headers.get('host')}${PYTHON_MERGE_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data,
        return_stats: parsed.return_stats,
      }),
    })

    if (!pyRes.ok) {
      const errJson = await pyRes.json().catch(() => ({ error: 'Python function error' }))
      return NextResponse.json({
        error: 'Python merge gagal',
        details: errJson.error || errJson.details || `HTTP ${pyRes.status}`,
        hint: 'Pastikan Python function ter-deploy di /api/pks_merge dengan python-docx terinstall',
      }, { status: 502 })
    }

    // ============================================================
    // 3. Audit log
    // ============================================================
    if (pipeline_id) {
      const statsFromHeaders = {
        replaced: pyRes.headers.get('X-Stats-Replaced') || '?',
        empty_filled: pyRes.headers.get('X-Stats-Empty-Filled') || '?',
        missing_data: pyRes.headers.get('X-Stats-Missing') || '?',
        structure_valid: pyRes.headers.get('X-Stats-Structure-Valid') === 'true',
      }

      await logAudit({
        user_id: me.id,
        kantor_cabang_id,
        action: 'generate_pks_docx',
        entity_type: 'pipeline',
        entity_id: pipeline_id,
        after_data: {
          pks_id,
          stats: statsFromHeaders,
          bytes: pyRes.headers.get('Content-Length') || 0,
        },
        ip: req.headers.get('x-forwarded-for') || undefined,
        user_agent: req.headers.get('user-agent') || undefined,
      })
    }

    // ============================================================
    // 4. Return response — proxy langsung dari Python function
    // ============================================================
    if (parsed.return_stats) {
      // JSON response
      const json = await pyRes.json()
      return NextResponse.json(json)
    }

    // Binary .docx — stream langsung dari Python function
    const docxBuffer = Buffer.from(await pyRes.arrayBuffer())
    const filename = `PKS_${(data.NAMA_FASKES || 'draft').replace(/\s+/g, '_')}.docx`

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.length.toString(),
        'X-Stats-Replaced': pyRes.headers.get('X-Stats-Replaced') || '0',
        'X-Stats-Empty-Filled': pyRes.headers.get('X-Stats-Empty-Filled') || '0',
        'X-Stats-Missing': pyRes.headers.get('X-Stats-Missing') || '0',
        'X-Stats-Structure-Valid': pyRes.headers.get('X-Stats-Structure-Valid') || 'false',
      },
    })

  } catch (e: any) {
    console.error('Generate-docx error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


// ============================================================
// GET endpoint — proxy ke Python function untuk health check
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const pyRes = await fetch(`https://${req.headers.get('host')}${PYTHON_MERGE_URL}`, {
      method: 'GET',
    })

    if (!pyRes.ok) {
      return NextResponse.json({
        ok: false,
        error: 'Python function tidak ter-deploy',
        hint: 'Pastikan file api/pks_merge.py ter-commit ke repo',
        status: pyRes.status,
      }, { status: 502 })
    }

    const json = await pyRes.json()
    return NextResponse.json({
      ok: true,
      service: 'generate-docx (orchestrator)',
      python_service: json,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
