'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Plus, Key, Power, Star, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface AIKey {
  id: string
  provider: string
  label: string
  api_key: string | null
  base_url: string | null
  model: string | null
  is_active: boolean
  is_default: boolean
  last_used_at: string | null
  last_error: string | null
  error_count: number
  quota_exhausted: boolean
  quota_reset_at: string | null
  created_at: string
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini (Barat)',
  openai: 'OpenAI / GPT (Barat)',
  zhipu: 'Zhipu / GLM (China)',
  deepseek: 'DeepSeek (China)',
  qwen: 'Qwen / Alibaba (China)',
  claude: 'Anthropic Claude (Barat)',
}

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  zhipu: 'glm-4-flash',
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  claude: 'claude-3-haiku-20240307',
}

export function AISettingsManager() {
  const [keys, setKeys] = useState<AIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    provider: 'gemini',
    label: '',
    api_key: '',
    base_url: '',
    model: '',
    is_default: false,
  })

  useEffect(() => { fetchKeys() }, [])

  async function fetchKeys() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai-keys')
      const data = await res.json()
      setKeys(data.data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch('/api/ai-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          model: form.model || PROVIDER_DEFAULT_MODELS[form.provider] || '',
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('API key berhasil ditambahkan')
      setDialogOpen(false)
      setForm({ provider: 'gemini', label: '', api_key: '', base_url: '', model: '', is_default: false })
      fetchKeys()
    } catch (e: any) { toast.error(e.message) }
  }

  async function toggleActive(key: AIKey) {
    try {
      await fetch(`/api/ai-keys?id=${key.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !key.is_active })
      })
      fetchKeys()
    } catch (e: any) { toast.error(e.message) }
  }

  async function setDefault(key: AIKey) {
    try {
      await fetch(`/api/ai-keys?id=${key.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true })
      })
      toast.success(`${key.label} set sebagai default`)
      fetchKeys()
    } catch (e: any) { toast.error(e.message) }
  }

  async function resetQuota(key: AIKey) {
    try {
      await fetch(`/api/ai-keys?id=${key.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quota_exhausted: false })
      })
      toast.success('Quota direset')
      fetchKeys()
    } catch (e: any) { toast.error(e.message) }
  }

  async function deleteKey(key: AIKey) {
    if (!confirm(`Hapus key "${key.label}"?`)) return
    try {
      await fetch(`/api/ai-keys?id=${key.id}`, { method: 'DELETE' })
      toast.success('Key dihapus')
      fetchKeys()
    } catch (e: any) { toast.error(e.message) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Key className="w-5 h-5" /> AI API Keys</h2>
          <p className="text-sm text-slate-500">Kelola API key untuk fitur AI (kajian tarif, dll). Auto-rotate jika quota habis.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1" /> Tambah Key</Button>
      </div>

      {keys.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Belum ada API key. Tambahkan untuk menggunakan fitur AI.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <Card key={k.id} className={!k.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline">{PROVIDER_LABELS[k.provider] || k.provider}</Badge>
                      <span className="font-semibold text-sm">{k.label}</span>
                      {k.is_default && <Badge className="bg-blue-100 text-blue-800"><Star className="w-3 h-3 mr-0.5" /> Default</Badge>}
                      {!k.is_active && <Badge variant="outline" className="text-slate-400">Nonaktif</Badge>}
                      {k.quota_exhausted && <Badge className="bg-red-100 text-red-800">⚠️ Quota Habis</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 flex gap-3 flex-wrap">
                      <span>Key: <code className="bg-slate-100 px-1 rounded">{k.api_key}</code></span>
                      {k.model && <span>Model: {k.model}</span>}
                      {k.last_used_at && <span>Terakhir dipakai: {new Date(k.last_used_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                    </div>
                    {k.last_error && <div className="text-xs text-red-600 mt-1">⚠️ {k.last_error.substring(0, 100)}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!k.is_active ? (
                      <Button size="icon" variant="ghost" onClick={() => toggleActive(k)} title="Aktifkan"><Power className="w-4 h-4 text-green-600" /></Button>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => toggleActive(k)} title="Nonaktifkan"><Power className="w-4 h-4 text-red-600" /></Button>
                    )}
                    {!k.is_default && k.is_active && (
                      <Button size="icon" variant="ghost" onClick={() => setDefault(k)} title="Set Default"><Star className="w-4 h-4 text-blue-600" /></Button>
                    )}
                    {k.quota_exhausted && (
                      <Button size="icon" variant="ghost" onClick={() => resetQuota(k)} title="Reset Quota"><RefreshCw className="w-4 h-4 text-yellow-600" /></Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => deleteKey(k)} title="Hapus"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Key Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah API Key</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>Provider *</Label>
              <Select value={form.provider} onValueChange={v => setForm(f => ({ ...f, provider: v, model: PROVIDER_DEFAULT_MODELS[v] || '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Label</Label><Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Contoh: Gemini Utama" /></div>
            <div><Label>API Key *</Label><Input value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder="AIza..." required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Model</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder={PROVIDER_DEFAULT_MODELS[form.provider] || ''} /></div>
              <div><Label>Base URL (opsional)</Label><Input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="Auto" /></div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm">Set sebagai default untuk provider ini</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit">Tambah Key</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
