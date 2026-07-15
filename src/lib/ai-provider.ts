import { supabaseAdmin } from '@/lib/supabase'

// ============================================================
// AI PROVIDER — Unified client dengan auto-rotate
// Support: Gemini, OpenAI, Zhipu (GLM), DeepSeek, Qwen
// ============================================================

export type AIProvider = 'gemini' | 'openai' | 'zhipu' | 'deepseek' | 'qwen' | 'claude'

interface AIKey {
  id: string
  provider: AIProvider
  api_key: string
  base_url: string | null
  model: string | null
  is_active: boolean
  quota_exhausted: boolean
  quota_reset_at: string | null
}

// Get available keys for a provider (active, not exhausted)
async function getAvailableKeys(provider?: AIProvider): Promise<AIKey[]> {
  let query = supabaseAdmin
    .from('wpa_ai_api_keys')
    .select('id, provider, api_key, base_url, model, is_active, quota_exhausted, quota_reset_at')
    .eq('is_active', true)
    .eq('quota_exhausted', false)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (provider) {
    query = query.eq('provider', provider)
  }

  const { data, error } = await query
  if (error || !data || data.length === 0) return []
  return data as AIKey[]
}

// Mark key as exhausted (quota habis)
async function markKeyExhausted(keyId: string, error: string) {
  await supabaseAdmin
    .from('wpa_ai_api_keys')
    .update({
      quota_exhausted: true,
      quota_reset_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // reset dalam 1 jam
      last_error: error,
      error_count: 1,
    })
    .eq('id', keyId)
}

// Mark key as used (update last_used_at)
async function markKeyUsed(keyId: string) {
  await supabaseAdmin
    .from('wpa_ai_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyId)
}

// Reset exhausted keys yang sudah lewat quota_reset_at
async function resetExhaustedKeys() {
  await supabaseAdmin
    .from('wpa_ai_api_keys')
    .update({ quota_exhausted: false, last_error: null })
    .eq('quota_exhausted', true)
    .lt('quota_reset_at', new Date().toISOString())
}

export interface AIResponse {
  text: string
  provider: string
  key_id: string
}

// ============================================================
// MAIN: Call AI dengan auto-rotate
// ============================================================
export async function callAI(
  prompt: string,
  preferredProvider?: AIProvider
): Promise<AIResponse> {
  await resetExhaustedKeys()

  // Get available keys (preferred provider first, then fallback to any)
  let keys = preferredProvider ? await getAvailableKeys(preferredProvider) : []
  if (keys.length === 0) {
    // Fallback: try all providers
    keys = await getAvailableKeys()
  }

  if (keys.length === 0) {
    throw new Error('Tidak ada API key AI yang tersedia. Tambahkan key di menu Settings.')
  }

  let lastError = ''
  for (const key of keys) {
    try {
      const result = await callProvider(key, prompt)
      await markKeyUsed(key.id)
      return result
    } catch (e: any) {
      lastError = e.message
      // Kalau 429 (rate limit) atau 403 (quota), mark as exhausted
      if (e.message.includes('429') || e.message.includes('quota') || e.message.includes('rate limit') || e.message.includes('RESOURCE_EXHAUSTED')) {
        await markKeyExhausted(key.id, e.message)
      }
      // Try next key
      continue
    }
  }

  throw new Error(`Semua API key gagal. Error terakhir: ${lastError}`)
}

// ============================================================
// Provider implementations
// ============================================================
async function callProvider(key: AIKey, prompt: string): Promise<AIResponse> {
  switch (key.provider) {
    case 'gemini':
      return callGemini(key, prompt)
    case 'openai':
      return callOpenAI(key, prompt)
    case 'zhipu':
      return callZhipu(key, prompt)
    case 'deepseek':
      return callDeepSeek(key, prompt)
    case 'qwen':
      return callQwen(key, prompt)
    default:
      throw new Error(`Provider ${key.provider} tidak didukung`)
  }
}

// Gemini (Google AI)
async function callGemini(key: AIKey, prompt: string): Promise<AIResponse> {
  const model = key.model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key.api_key}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.substring(0, 200)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!text) throw new Error('Gemini: response kosong')

  return { text, provider: 'gemini', key_id: key.id }
}

// OpenAI (GPT)
async function callOpenAI(key: AIKey, prompt: string): Promise<AIResponse> {
  const baseUrl = key.base_url || 'https://api.openai.com/v1'
  const model = key.model || 'gpt-4o-mini'
  const url = `${baseUrl}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key.api_key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${res.status}: ${err.substring(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('OpenAI: response kosong')

  return { text, provider: 'openai', key_id: key.id }
}

// Zhipu (GLM — China)
async function callZhipu(key: AIKey, prompt: string): Promise<AIResponse> {
  const baseUrl = key.base_url || 'https://open.bigmodel.cn/api/paas/v4'
  const model = key.model || 'glm-4-flash'
  const url = `${baseUrl}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key.api_key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Zhipu ${res.status}: ${err.substring(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('Zhipu: response kosong')

  return { text, provider: 'zhipu', key_id: key.id }
}

// DeepSeek (China)
async function callDeepSeek(key: AIKey, prompt: string): Promise<AIResponse> {
  const baseUrl = key.base_url || 'https://api.deepseek.com/v1'
  const model = key.model || 'deepseek-chat'
  const url = `${baseUrl}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key.api_key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek ${res.status}: ${err.substring(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('DeepSeek: response kosong')

  return { text, provider: 'deepseek', key_id: key.id }
}

// Qwen (Alibaba — China)
async function callQwen(key: AIKey, prompt: string): Promise<AIResponse> {
  const baseUrl = key.base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const model = key.model || 'qwen-turbo'
  const url = `${baseUrl}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key.api_key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Qwen ${res.status}: ${err.substring(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('Qwen: response kosong')

  return { text, provider: 'qwen', key_id: key.id }
}

// ============================================================
// Helper: normalize item name for fuzzy match
// ============================================================
export function normalizeItemName(name: string): string {
  return name.toLowerCase()
    .replace(/kelas/g, '')
    .replace(/room/g, '')
    .replace(/class/g, '')
    .replace(/per\s+\w+/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// 3-layer fuzzy match
export function fuzzyMatch(
  itemA: string,
  itemB: string,
  aliases: string[] = []
): boolean {
  const normA = normalizeItemName(itemA)
  const normB = normalizeItemName(itemB)

  // Layer 1: Exact match (normalized)
  if (normA === normB && normA.length > 0) return true

  // Layer 2: Contains match (one contains the other, min 4 chars)
  if (normA.length >= 4 && normB.includes(normA)) return true
  if (normB.length >= 4 && normA.includes(normB)) return true

  // Layer 3: Alias match
  for (const alias of aliases) {
    const normAlias = normalizeItemName(alias)
    if (normAlias === normA || (normAlias.length >= 4 && (normA.includes(normAlias) || normAlias.includes(normA)))) {
      return true
    }
  }

  return false
}

// Klasifikasi kewajaran tarif
export function classifyTarif(
  tarifDiajukan: number,
  tarifAcuan: number | null
): { status: string; selisih: number | null; selisihPct: number | null } {
  if (tarifAcuan === null || tarifAcuan === 0) {
    return { status: 'NO_ACUAN', selisih: null, selisihPct: null }
  }
  const selisih = tarifDiajukan - tarifAcuan
  const selisihPct = (selisih / tarifAcuan) * 100
  const absPct = Math.abs(selisihPct)

  if (absPct <= 5) return { status: 'WAJAR', selisih, selisihPct }
  if (absPct <= 20) return { status: 'PERLU_REVIEW', selisih, selisihPct }
  return { status: 'TIDAK_WAJAR', selisih, selisihPct }
}
