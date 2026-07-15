import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// GET /api/pengajuan-dokumen/list?pipeline_id=X or ?faskes_id=X
export async function GET(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const pipelineId = searchParams.get('pipeline_id')
    const faskesId = searchParams.get('faskes_id')

    if (!pipelineId && !faskesId) {
      return NextResponse.json({ error: 'pipeline_id atau faskes_id wajib diisi' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('wpa_pengajuan_dokumen')
      .select(`
        id,
        pipeline_id,
        faskes_id,
        jenis,
        file_name,
        file_url,
        file_size,
        mime_type,
        uploaded_by,
        uploaded_at,
        verified,
        verified_by,
        verified_at,
        catatan,
        wpa_users(full_name)
      `)
      .order('uploaded_at', { ascending: true })

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId)
    } else if (faskesId) {
      query = query.eq('faskes_id', faskesId)
    }

    const { data, error } = await query
    if (error) throw error

    // For each file, regenerate signed URL (since the stored URL may have expired)
    // The signed URL is valid for 7 days, but if user opens after that, we need to refresh.
    // We use the catatan field which stores storage_path.
    const enrichedData = await Promise.all((data || []).map(async (doc: any) => {
      const storagePath = doc.catatan?.startsWith('storage_path:')
        ? doc.catatan.replace('storage_path:', '')
        : null

      let freshUrl = doc.file_url
      if (storagePath) {
        try {
          const { data: urlData } = await supabaseAdmin
            .storage
            .from('wpa-pengajuan-docs')
            .createSignedUrl(storagePath, 3600 * 24 * 7)
          if (urlData?.signedUrl) freshUrl = urlData.signedUrl
        } catch {
          // Fall back to stored URL
        }
      }

      return {
        ...doc,
        file_url: freshUrl,
        uploader_name: doc.wpa_users?.full_name || null,
      }
    }))

    return NextResponse.json({ data: enrichedData })
  } catch (e: any) {
    console.error('Dokumen list error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
