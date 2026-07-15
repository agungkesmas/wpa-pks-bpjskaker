'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, ArrowLeft, FileEdit, Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface PlaceholderDef {
  key: string
  label: string
  tipe: string  // 'auto_fill' | 'manual_required' | 'manual_optional'
  required: boolean
  urutan: number
  kategori: string | null
}

interface Template {
  id: string
  kode: string
  nama: string
  version: string
  judul_kartu: string | null
  is_masal: boolean
  is_active: boolean
  placeholders: any
  file_docx_url: string | null
  uploaded_at: string
  placeholder_definitions: PlaceholderDef[]
}

export default function AdendumMasalFormPage({ params }: { params: Promise<{ templateId: string }> }) {
  const router = useRouter()
  const { templateId } = use(params)

  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [catatan, setCatatan] = useState('')

  useEffect(() => {
    fetchTemplate()
  }, [templateId])

  async function fetchTemplate() {
    try {
      const res = await fetch('/api/adendum-masal/list-templates')
      const data = await res.json()
      if (res.ok) {
        const tpl = (data.data || []).find((t: Template) => t.id === templateId)
        if (!tpl) {
          toast.error('Template tidak ditemukan atau sudah tidak aktif')
          router.push('/pic_rs/ajukan-baru')
          return
        }
        setTemplate(tpl)
        // Initialize values with empty strings
        const init: Record<string, string> = {}
        ;(tpl.placeholder_definitions || []).forEach(p => {
          init[p.key] = ''
        })
        setValues(init)
      } else {
        toast.error(data.error)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleValueChange(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!template) return

    // Validate required fields
    const missing: string[] = []
    ;(template.placeholder_definitions || []).forEach(p => {
      if (p.required && !values[p.key]?.trim()) {
        missing.push(p.label || p.key)
      }
    })
    if (missing.length > 0) {
      toast.error(`Field wajib belum diisi: ${missing.join(', ')}`)
      return
    }

    setSubmitting(true)
    // Confirm before submit
    if (!confirm(`Kirim adendum masal "${template.judul_kartu || template.nama}" ke CM? Setelah dikirim, Anda tidak bisa edit.`)) {
      setSubmitting(false)
      return
    }

    fetch('/api/adendum-masal/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: templateId,
        placeholder_values: values,
        catatan,
      })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error)
        toast.success(data.message)
        router.push('/pic_rs/pengajuan')
      })
      .catch(e => toast.error(e.message))
      .finally(() => setSubmitting(false))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Template tidak ditemukan</p>
      </div>
    )
  }

  // Group placeholders by kategori
  const phByKategori: Record<string, PlaceholderDef[]> = {}
  ;(template.placeholder_definitions || []).forEach(p => {
    const k = p.kategori || 'lainnya'
    if (!phByKategori[k]) phByKategori[k] = []
    phByKategori[k].push(p)
  })

  const manualPlaceholders = (template.placeholder_definitions || []).filter(p => p.tipe !== 'auto_fill')
  const autoFillCount = (template.placeholder_definitions || []).filter(p => p.tipe === 'auto_fill').length

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Kembali
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileEdit className="w-6 h-6 text-amber-700" />
          {template.judul_kartu || template.nama}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Adendum Masal dari Kantor Pusat · Kode: {template.kode} · v{template.version}
        </p>
      </div>

      <Alert className="bg-amber-50 border-amber-200">
        <Info className="w-4 h-4 text-amber-700" />
        <AlertDescription className="text-amber-900">
          <strong>Alur:</strong> Isi placeholder → Review → Kirim ke CM → CM cek & beri jawaban.
          {autoFillCount > 0 && (
            <span className="block mt-1 text-xs">
              {autoFillCount} field akan diisi otomatis dari data faskes Anda saat dokumen final di-generate.
            </span>
          )}
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Placeholder Form */}
        {manualPlaceholders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-slate-700">
                Template ini tidak punya field yang perlu Anda isi. Semua placeholder akan diisi otomatis dari data faskes Anda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Isi Data Adendum</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {manualPlaceholders.map(p => (
                <div key={p.key}>
                  <Label>
                    {p.label || p.key}
                    {p.required && <span className="text-red-600 ml-1">*</span>}
                  </Label>
                  <Input
                    value={values[p.key] || ''}
                    onChange={e => handleValueChange(p.key, e.target.value)}
                    placeholder={`Masukkan ${p.label?.toLowerCase() || p.key.toLowerCase()}`}
                    required={p.required}
                  />
                  <p className="text-xs text-slate-400 mt-1">Key: <code className="bg-slate-100 px-1 rounded">{p.key}</code></p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Catatan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catatan untuk CM (opsional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              rows={3}
              placeholder="Catatan tambahan untuk Case Manager..."
            />
          </CardContent>
        </Card>

        {/* Review Summary */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-700" />
              Review Sebelum Kirim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-700 space-y-1">
              <div><strong>Template:</strong> {template.judul_kartu || template.nama}</div>
              <div><strong>Kode:</strong> {template.kode} (v{template.version})</div>
              <div><strong>Total field diisi:</strong> {manualPlaceholders.filter(p => values[p.key]?.trim()).length} / {manualPlaceholders.length}</div>
              <div><strong>Auto-fill (dari data faskes):</strong> {autoFillCount} field</div>
            </div>
            <Alert className="mt-3 bg-yellow-50 border-yellow-200">
              <AlertCircle className="w-4 h-4 text-yellow-700" />
              <AlertDescription className="text-yellow-900 text-xs">
                Setelah dikirim, Anda tidak bisa edit. CM akan review dan beri jawaban (setuju/tolak).
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting} className="bg-amber-700 hover:bg-amber-800 flex-1">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</> : <><Send className="w-4 h-4 mr-2" /> Kirim ke CM</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
        </div>
      </form>
    </div>
  )
}
