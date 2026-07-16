import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession, logAudit } from '@/lib/auth'
import { z } from 'zod'

// GET /api/ai-keys — list all API keys
export async function GET() {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'case_manager' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('wpa_ai_api_keys')
      .select('id, provider, label, api_key, base_url, model, is_active, is_default, last_used_at, last_error, error_count, quota_exhausted, quota_reset_at, created_at')
      .order('provider', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    // Mask API key (tampilkan 8 char pertama + ***)
    const masked = (data || []).map((k: any) => ({
      ...k,
      api_key: k.api_key ? k.api_key.substring(0, 8) + '••••••••' : null,
    }))

    return NextResponse.json({ data: masked })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

const createSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'zhipu', 'deepseek', 'qwen', 'claude']),
  label: z.string().optional(),
  api_key: z.string().min(10),
  base_url: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  is_default: z.boolean().default(false),
})

// POST — create new API key
export async function POST(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'case_manager' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const body = await req.json()
    const data = createSchema.parse(body)

    // Kalau is_default=true, unset default lain untuk provider yang sama
    if (data.is_default) {
      await supabaseAdmin
        .from('wpa_ai_api_keys')
        .update({ is_default: false })
        .eq('provider', data.provider)
    }

    const { data: newKey, error } = await supabaseAdmin
      .from('wpa_ai_api_keys')
      .insert({
        provider: data.provider,
        label: data.label || `${data.provider} key`,
        api_key: data.api_key,
        base_url: data.base_url || null,
        model: data.model || null,
        is_active: true,
        is_default: data.is_default,
        created_by: me.id,
      })
      .select('id')
      .single()

    if (error) throw error

    await logAudit({
      user_id: me.id,
      action: 'ai_key_create',
      entity_type: 'wpa_ai_api_keys',
      entity_id: newKey.id,
      after_data: { provider: data.provider, label: data.label },
    })

    return NextResponse.json({ success: true, id: newKey.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — update key (activate/deactivate, set default)
export async function PATCH(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'case_manager' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

    const body = await req.json()
    const updates: any = {}
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.is_default !== undefined) {
      updates.is_default = body.is_default
      // Unset default lain untuk provider yang sama
      if (body.is_default) {
        const { data: keyData } = await supabaseAdmin.from('wpa_ai_api_keys').select('provider').eq('id', id).single()
        if (keyData) {
          await supabaseAdmin.from('wpa_ai_api_keys').update({ is_default: false }).eq('provider', keyData.provider).neq('id', id)
        }
      }
    }
    if (body.quota_exhausted !== undefined) updates.quota_exhausted = body.quota_exhausted
    if (body.api_key) updates.api_key = body.api_key
    if (body.model !== undefined) updates.model = body.model
    if (body.base_url !== undefined) updates.base_url = body.base_url
    if (body.label !== undefined) updates.label = body.label
    updates.updated_at = new Date().toISOString()

    const { error } = await supabaseAdmin.from('wpa_ai_api_keys').update(updates).eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE
export async function DELETE(req: NextRequest) {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'case_manager' && me.role !== 'kepala_bidang') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

    const { error } = await supabaseAdmin.from('wpa_ai_api_keys').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
