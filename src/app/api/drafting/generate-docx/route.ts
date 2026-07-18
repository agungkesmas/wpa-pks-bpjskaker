import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

// ============================================================
// API: /api/drafting/generate-docx
// ============================================================
// Generate PKS .docx via Python mail merge (scripts/pks_merge.py)
//
// Flow:
// 1. PIC RS / CM isi form 85 placeholder → submit
// 2. API ini download template .docx dari Supabase Storage (atau pakai local)
// 3. Spawn Python child process: pks_merge.py --template ... --input ... --output ...
// 4. Return binary .docx ke client (download)
//
// Alternative: kalau tidak ada Supabase env, pakai local template
// di /templates/pks_template_bersih.docx
//
// Output: binary .docx (download) atau JSON dengan stats
// ============================================================

const schema = z.object({
  pipeline_id: z.string().uuid().optional(),
  data: z.record(z.string(), z.any()).optional(),
  // Kalau pipeline_id diisi, data akan diambil dari wpa_pks.data_jsonb
  // Kalau data diisi langsung, pakai itu (untuk testing)
  return_stats: z.boolean().optional().default(false),
  // true: return JSON {ok, stats, file_base64} — untuk preview
  // false: return binary .docx stream (default, untuk download)
})

// Path ke Python script dan template (local filesystem)
const PYTHON_SCRIPT = path.join(process.cwd(), 'scripts', 'pks_merge.py')
const LOCAL_TEMPLATE = path.join(process.cwd(), 'templates', 'pks_template_bersih.docx')

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

    if (parsed.pipeline_id) {
      // Ambil data dari wpa_pipeline + wpa_pks
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

      // Ambil data_jsonb, exclude internal keys
      data = { ...pks.data_jsonb }
      delete data.html_content // legacy
      delete data._meta
    } else if (parsed.data) {
      data = parsed.data
    } else {
      return NextResponse.json({
        error: 'Harus isi pipeline_id ATAU data'
      }, { status: 400 })
    }

    // ============================================================
    // 2. Dapatkan template path
    // ============================================================
    let templatePath = LOCAL_TEMPLATE
    let templateSource = 'local'

    // Cek apakah local template ada
    try {
      await fs.access(LOCAL_TEMPLATE)
    } catch {
      // Local tidak ada, coba download dari Supabase Storage
      templateSource = 'supabase'

      // Kalau ada pks_id, ambil template_id dari pks
      let template_id: string | undefined
      if (pks_id) {
        const { data: pks } = await supabaseAdmin
          .from('wpa_pks')
          .select('template_id')
          .eq('id', pks_id)
          .single()
        template_id = pks?.template_id || undefined
      }

      if (template_id) {
        const { data: template } = await supabaseAdmin
          .from('wpa_pks_template')
          .select('file_docx_path')
          .eq('id', template_id)
          .single()

        if (template?.file_docx_path) {
          const { data: fileData, error: dlErr } = await supabaseAdmin
            .storage.from('wpa-templates')
            .download(template.file_docx_path)
          if (dlErr || !fileData) {
            return NextResponse.json({ error: 'Gagal download template dari Storage' }, { status: 500 })
          }
          // Save to temp file
          const tmpPath = path.join(os.tmpdir(), `template_${Date.now()}.docx`)
          await fs.writeFile(tmpPath, Buffer.from(await fileData.arrayBuffer()))
          templatePath = tmpPath
        }
      }
    }

    // ============================================================
    // 3. Tulis data JSON ke temp file (untuk Python input)
    // ============================================================
    const tmpDir = os.tmpdir()
    const inputPath = path.join(tmpDir, `pks_input_${Date.now()}.json`)
    const outputPath = path.join(tmpDir, `pks_output_${Date.now()}.docx`)
    const statsPath = path.join(tmpDir, `pks_stats_${Date.now()}.json`)

    await fs.writeFile(inputPath, JSON.stringify(data), 'utf-8')

    // ============================================================
    // 4. Spawn Python: pks_merge.py --template ... --input ... --output ...
    // ============================================================
    const result = await new Promise<{ success: boolean; stderr: string; stats?: any }>((resolve) => {
      const py = spawn('python3', [
        PYTHON_SCRIPT,
        '--template', templatePath,
        '--input', inputPath,
        '--output', outputPath,
        '--stats', statsPath,
      ])

      let stderr = ''
      py.stderr.on('data', (chunk) => { stderr += chunk.toString() })
      py.on('error', (err) => {
        resolve({ success: false, stderr: `Failed to spawn python3: ${err.message}. Make sure python3 + python-docx installed.` })
      })
      py.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, stderr })
          return
        }
        // Read stats
        fs.readFile(statsPath, 'utf-8')
          .then((statsStr) => {
            try {
              resolve({ success: true, stderr, stats: JSON.parse(statsStr) })
            } catch {
              resolve({ success: true, stderr })
            }
          })
          .catch(() => resolve({ success: true, stderr }))
      })
    })

    // Cleanup temp files
    await fs.unlink(inputPath).catch(() => {})
    await fs.unlink(statsPath).catch(() => {})
    if (templateSource === 'supabase') {
      await fs.unlink(templatePath).catch(() => {})
    }

    if (!result.success) {
      return NextResponse.json({
        error: 'Python merge gagal',
        details: result.stderr.substring(0, 2000)
      }, { status: 500 })
    }

    // ============================================================
    // 5. Baca output .docx
    // ============================================================
    const docxBuffer = await fs.readFile(outputPath)
    await fs.unlink(outputPath).catch(() => {})

    // ============================================================
    // 6. Audit log
    // ============================================================
    if (pipeline_id) {
      await logAudit({
        user_id: me.id,
        kantor_cabang_id: undefined, // bisa diambil dari pipeline kalau perlu
        action: 'generate_pks_docx',
        entity_type: 'pipeline',
        entity_id: pipeline_id,
        after_data: {
          pks_id,
          stats: result.stats,
          bytes: docxBuffer.length,
        },
        ip: req.headers.get('x-forwarded-for') || undefined,
        user_agent: req.headers.get('user-agent') || undefined,
      })
    }

    // ============================================================
    // 7. Return response
    // ============================================================
    if (parsed.return_stats) {
      // Mode preview: return JSON with stats + base64 file
      const base64 = docxBuffer.toString('base64')
      return NextResponse.json({
        ok: true,
        stats: result.stats,
        file_base64: base64,
        filename: `PKS_${(data.NAMA_FASKES || 'draft').replace(/\s+/g, '_')}.docx`,
        bytes: docxBuffer.length,
      })
    }

    // Mode download: return binary stream
    const filename = `PKS_${(data.NAMA_FASKES || 'draft').replace(/\s+/g, '_')}.docx`
    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.length.toString(),
        'X-Stats-Replaced': String(result.stats?.replaced || 0),
        'X-Stats-Empty-Filled': String(result.stats?.empty_filled || 0),
        'X-Stats-Missing': String(result.stats?.missing_data || 0),
        'X-Stats-Structure-Valid': String(result.stats?.structure_valid || false),
      },
    })

  } catch (e: any) {
    console.error('Generate-docx error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


// ============================================================
// GET endpoint — untuk test & dapatkan list placeholder
// ============================================================
export async function GET() {
  try {
    // Cek apakah Python + script tersedia
    const result = await new Promise<{ ok: boolean; output: string; error: string }>((resolve) => {
      const py = spawn('python3', [
        PYTHON_SCRIPT,
        '--template', LOCAL_TEMPLATE,
        '--list-placeholders',
      ])
      let stdout = ''
      let stderr = ''
      py.stdout.on('data', (chunk) => { stdout += chunk.toString() })
      py.stderr.on('data', (chunk) => { stderr += chunk.toString() })
      py.on('error', (err) => resolve({ ok: false, output: '', error: err.message }))
      py.on('close', (code) => {
        if (code !== 0) resolve({ ok: false, output: stdout, error: stderr })
        else resolve({ ok: true, output: stdout, error: stderr })
      })
    })

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: 'Python script gagal jalan',
        details: result.error,
        hint: 'Pastikan python3 + python-docx terinstall: pip3 install python-docx',
        script_path: PYTHON_SCRIPT,
        template_path: LOCAL_TEMPLATE,
      }, { status: 500 })
    }

    const placeholdersData = JSON.parse(result.output)
    return NextResponse.json({
      ok: true,
      service: 'generate-docx',
      script: PYTHON_SCRIPT,
      template: LOCAL_TEMPLATE,
      placeholders: placeholdersData.placeholders,
      count: placeholdersData.count,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
