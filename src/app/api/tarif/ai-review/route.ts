import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { callAI } from '@/lib/ai-provider'

// POST /api/tarif/ai-review?pipeline_id=X
// AI second opinion (opsional) — kirim summary scan ke AI untuk rekomendasi naratif
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const pipelineId = searchParams.get('pipeline_id')
    if (!pipelineId) return NextResponse.json({ error: 'pipeline_id wajib' }, { status: 400 })

    const body = await req.json()
    const { summary, detail } = body

    if (!summary || !detail) {
      return NextResponse.json({ error: 'summary dan detail wajib diisi' }, { status: 400 })
    }

    // Build prompt untuk AI
    const prompt = `Anda adalah ahli kajian tarif BPJS Ketenagakerjaan. Berikut hasil scan tarif faskes:

SUMMARY:
- Total item: ${summary.total}
- Wajar (≤5%): ${summary.wajar}
- Perlu Review (5-20%): ${summary.perlu_review}
- Tidak Wajar (>20%): ${summary.tidak_wajar}
- No Acuan: ${summary.no_acuan}
- Sama dengan PKS lama: ${summary.sama_pks_lama}
- Berubah dari PKS lama: ${summary.berubah_pks_lama}
- Item baru: ${summary.baru}
- Auto-approve: ${summary.auto_approve}

DETAIL ITEM YANG PERLU PERHATIAN (tidak wajar / perlu review):
${detail.filter((d: any) => d.status_kewajaran === 'TIDAK_WAJAR' || d.status_kewajaran === 'PERLU_REVIEW').map((d: any) => 
  `- ${d.nama_item}: Rp ${d.tarif_diajukan} (acuan: ${d.tarif_acuan ? 'Rp ' + d.tarif_acuan : 'no acuan'}, selisih: ${d.selisih_pct !== null ? d.selisih_pct.toFixed(1) + '%' : '-'})`
).join('\n')}

Beri rekomendasi dalam format:
1. KESIMPULAN: [SETUJU / SETUJU DENGAN CATATAN / TIDAK SETUJU]
2. ALASAN: [jelas singkat, max 3 kalimat]
3. REKOMENDASI: [lanjut ke kredensialing / return ke PIC RS / review manual]`

    const result = await callAI(prompt, 'gemini')

    // Simpan AI review ke pipeline_log
    await supabaseAdmin.from('wpa_pipeline_log').insert({
      pipeline_id: pipelineId,
      tahap: 'ditinjau_kajian_tarif',
      action: 'submit',
      performed_by: me.id,
      catatan: `AI Review (${result.provider}): ${result.text.substring(0, 500)}`,
      metadata: { ai_review: { provider: result.provider, text: result.text } },
    })

    return NextResponse.json({
      success: true,
      text: result.text,
      provider: result.provider,
    })
  } catch (e: any) {
    console.error('AI review error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
