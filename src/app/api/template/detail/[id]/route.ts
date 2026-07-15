import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    
    const { data: template, error } = await supabaseAdmin
      .from('wpa_pks_template')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !template) {
      return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
    }
    
    // Get babs
    const { data: babs } = await supabaseAdmin
      .from('wpa_template_bab')
      .select('*')
      .eq('template_id', id)
      .order('urutan', { ascending: true })
    
    // Get placeholders
    const { data: placeholders } = await supabaseAdmin
      .from('wpa_pks_template_placeholder')
      .select('*')
      .eq('template_id', id)
      .order('bab_id', { ascending: true })
      .order('urutan_dalam_bab', { ascending: true })
    
    // Group placeholders by bab
    const placeholderByBab: Record<string, any[]> = {}
    for (const p of placeholders || []) {
      if (!placeholderByBab[p.bab_id]) placeholderByBab[p.bab_id] = []
      placeholderByBab[p.bab_id].push(p)
    }
    
    return NextResponse.json({
      data: {
        ...template,
        babs: babs || [],
        placeholders: placeholders || [],
        placeholder_by_bab: placeholderByBab,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
