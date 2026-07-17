# 08 — AI Provider System (Multi-Provider + Auto-Rotate)

> Sumber: `src/lib/ai-provider.ts`
> Tujuan: Unified AI client dengan fallback otomatis kalau satu provider quota habis.

## Provider yang Didukung

| Provider | Enum value | Default model | API |
|---|---|---|---|
| Google Gemini | `gemini` | `gemini-2.0-flash` | Generative Language API |
| OpenAI | `openai` | `gpt-4o-mini` | Chat Completions |
| Zhipu (GLM) | `zhipu` | `glm-4-flash` | GLM Chat Completions |
| DeepSeek | `deepseek` | `deepseek-chat` | OpenAI-compatible |
| Qwen (Alibaba) | `qwen` | `qwen-turbo` | DashScope |
| Anthropic Claude | `claude` | `claude-3-5-sonnet` | Messages API |

> **Default:** Gemini (karena gratis quota-nya lumayan untuk dev). User bisa set default lain via `AISettingsManager.tsx`.

---

## Auto-Rotate Logic

```
1. Ambil semua key yang:
   - is_active = true
   - quota_exhausted = false
   - (optional) provider = X (kalau user specify provider)
   Urutkan by: is_default DESC, created_at ASC

2. For each key:
   a. Call AI dengan key ini
   b. If success:
      - Update last_used_at
      - Return response
   c. If error (quota / rate limit / auth):
      - Set quota_exhausted = true
      - Set quota_reset_at = now + 1 hour
      - Set last_error = error message
      - Continue to next key

3. If all keys exhausted:
   - Return error "All AI keys exhausted. Try again in 1 hour."
   - Cron job akan reset quota_exhausted setelah lewat quota_reset_at

4. Background reset:
   - Cron /api/cron/mutasi (atau cron baru) periodically:
     UPDATE wpa_ai_api_keys
     SET quota_exhausted = false, last_error = null
     WHERE quota_exhausted = true AND quota_reset_at < now()
```

---

## Schema DB

```sql
-- Lihat docs/04_DATABASE_SCHEMA.md section 17

create table wpa_ai_api_keys (
  id uuid primary key default gen_random_uuid(),
  kantor_cabang_id uuid references wpa_kantor_cabang(id),
  provider text not null,          -- gemini, openai, zhipu, deepseek, qwen, claude
  api_key text not null,
  base_url text,                   -- override default endpoint
  model text,                      -- override default model
  is_active boolean default true,
  is_default boolean default false,
  quota_exhausted boolean default false,
  quota_reset_at timestamptz,
  last_used_at timestamptz,
  last_error text,
  error_count int default 0,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table wpa_ai_tarif_review (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references wpa_pipeline(id) on delete cascade,
  provider text not null,
  key_id uuid references wpa_ai_api_keys(id),
  prompt text,
  response text,
  model text,
  tokens_used int,
  duration_ms int,
  created_at timestamptz default now()
);
```

---

## API Functions (`src/lib/ai-provider.ts`)

### `callAI(prompt, options?)`

```typescript
interface AICallOptions {
  provider?: AIProvider        // force specific provider
  max_tokens?: number          // default 1000
  temperature?: number         // default 0.7
  system_prompt?: string
  pipeline_id?: string         // for logging to wpa_ai_tarif_review
}

interface AIResponse {
  text: string
  provider: string
  key_id: string
}

async function callAI(prompt: string, options?: AICallOptions): Promise<AIResponse>
```

### Helper functions

```typescript
// Fuzzy match item name (3-layer: exact, contains, alias)
function fuzzyMatch(itemName: string, targetName: string): { matched: boolean; score: number; method: string }

// Classify tarif: ≤5% WAJAR, 5-20% REVIEW, >20% TIDAK WAJAR
function classifyTarif(tarifFaskes: number, tarifAcuan: number): {
  status: 'WAJAR' | 'REVIEW' | 'TIDAK_WAJAR'
  diff_pct: number
  recommendation: string
}

// AI second opinion untuk tarif (kajian tarif)
async function aiTarifReview(
  pipelineId: string,
  faskesName: string,
  tarifItems: Array<{ item: string; tarif: number; acuan: number }>
): Promise<{ narrative: string; outliers: string[] }>
```

---

## Penggunaan di Aplikasi

### 1. Tarif AI Review (tahap `ditinjau_kajian_tarif`)

PIC RS upload Excel tarif → `/api/tarif/scan` (pattern scan deterministic) → return `TarifScanResult` dengan summary cards + detail table.

CM klik "AI Second Opinion" (optional) → `/api/tarif/ai-review` → call `aiTarifReview()` → return narrative text + list outliers.

### 2. Bot Receptionist (login page)

BotReceptionist component → `/api/bot/chat` → call `callAI(userMessage)` dengan system prompt "Kamu adalah bot FAQ BPJS Ketenagakerjaan..." → return response.

Fallback rule-based kalau AI error (semua key exhausted).

### 3. Tidak ada penggunaan AI lain

AI **tidak** dipakai untuk:
- Drafting dokumen PKS (tidak boleh, harus PIC RS yang isi)
- Review dokumen PKS (harus CM yang review)
- Approval (harus Kabid)
- Generate template (harus Super Admin)

---

## AISettingsManager Component

UI untuk CM/Kabid manage AI keys:

- **Add Key**: form dengan provider dropdown, api_key, base_url (optional), model (optional)
- **List Keys**: tabel dengan provider, model, status (active/exhausted), last_used, is_default badge
- **Actions per key**:
  - Activate/Deactivate (toggle is_active)
  - Set as Default (radio button, only 1 default per cabang)
  - Reset Quota (manual reset quota_exhausted = false)
  - Delete
- **Security**: api_key tidak pernah ditampilkan full (hanya 4 digit terakhir)

---

## Environment Variables (TIDAK dipakai — pakai DB)

Sistem ini **tidak pakai env vars** untuk API keys. Semua key disimpan di DB (`wpa_ai_api_keys`) per kantor cabang. Alasannya:

1. Multi-tenant: tiap cabang bisa punya AI key sendiri (mis. cabang Jakarta pakai OpenAI, cabang Cirebon pakai Gemini)
2. UI-driven: CM/Kabid bisa add/edit/delete key tanpa deploy ulang
3. Security: key tidak ter-expose di `.env` file atau Vercel dashboard

**Yang ada di env (untuk initial bootstrap):**

```
# Hanya untuk initial Gemini key (dipakai kalau wpa_ai_api_keys kosong)
GEMINI_API_KEY=AIzaSyXXXX
GEMINI_MODEL=gemini-2.0-flash
```

Tapi ini optional. Kalau kosong, bot receptionist pakai rule-based fallback saja.

---

## Implementasi Detail

### Gemini Call

```typescript
async function callGemini(apiKey: string, prompt: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
    })
  })
  if (!res.ok) {
    const err = await res.text()
    if (res.status === 429) throw new Error('QUOTA_EXHAUSTED: ' + err)
    if (res.status === 401 || res.status === 403) throw new Error('AUTH_ERROR: ' + err)
    throw new Error('GEMINI_ERROR: ' + err)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}
```

### OpenAI Call (compatible dengan DeepSeek, Qwen)

```typescript
async function callOpenAICompatible(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string
): Promise<string> {
  const url = baseUrl + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7
    })
  })
  // ... same error handling as Gemini
  const data = await res.json()
  return data.choices[0].message.content
}
```

### Default base URLs

```typescript
const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',  // different endpoint structure
  openai: 'https://api.openai.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  claude: 'https://api.anthropic.com/v1'  // different message format
}
```

---

## Logging & Audit

Setiap AI call untuk tarif review di-log ke `wpa_ai_tarif_review`:

```typescript
await supabaseAdmin.from('wpa_ai_tarif_review').insert({
  pipeline_id: pipelineId,
  provider: response.provider,
  key_id: response.key_id,
  prompt: prompt.substring(0, 5000),  // truncate
  response: response.text.substring(0, 10000),
  model: model,
  tokens_used: null,  // tidak selalu tersedia
  duration_ms: duration
})
```

Bot receptionist chat **tidak di-log** ke DB (privacy concern + volume tinggi). Hanya log error ke console.

---

## Catatan untuk AI/Developer

1. **Jangan hardcode API key di code.** Selalu ambil dari DB via `getAvailableKeys()`.
2. **Error handling ketat.** Setiap error harus di-classify: QUOTA_EXHAUSTED (rotate), AUTH_ERROR (deactivate key), NETWORK_ERROR (retry once), UNKNOWN (log + rotate).
3. **Rate limiting.** Gemini free tier = 15 RPM, 1500 RPD. OpenAI = tergantung plan. Implementasi sekarang tidak ada client-side throttle, cuma auto-rotate kalau 429.
4. **Cost monitoring.** Tidak ada dashboard untuk monitor cost per cabang. Tambahkan kalau perlu (query `wpa_ai_tarif_review` + sum tokens_used).
5. **Claude support.** Anthropic pakai format message berbeda (`system` sebagai top-level param, bukan message). Implementasi sekarang belum handle ini dengan baik — kalau pakai Claude, test dulu.
