import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// GET /api/adendum-masal/list-templates
// Returns all templates where is_masal=true, for PIC RS to see as brown cards.
export async function GET() {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!['pic_rs', 'case_manager', 'kepala_bidang', 'super_admin'].includes(me.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { data: templates, error } = await supabaseAdmin
      .from('wpa_pks_template')
      .select(`
        id,
        kode,
        nama,
        version,
        judul_kartu,
        is_masal,
        is_active,
        placeholders,
        file_docx_url,
        uploaded_at
      `)
      .eq('is_masal', true)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })

    if (error) throw error

    // Also fetch placeholder definitions (labels, types) from wpa_pks_template_placeholder
    const templateIds = (templates || []).map((t: any) => t.id)
    let placeholderDefs: any[] = []
    if (templateIds.length > 0) {
      const { data: phData } = await supabaseAdmin
        .from('wpa_pks_template_placeholder')
        .select('template_id, key, label, tipe, required, urutan, kategori')
        .in('template_id', templateIds)
        .order('urutan', { ascending: true })
      placeholderDefs = phData || []
    }

    // Merge: each template gets its placeholders array
    const enriched = (templates || []).map((t: any) => ({
      ...t,
      placeholder_definitions: placeholderDefs.filter(p => p.template_id === t.id),
    }))

    return NextResponse.json({ data: enriched })
  } catch (e: any) {
    console.error('List templates masal error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
