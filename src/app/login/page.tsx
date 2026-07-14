'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ShieldCheck, HeartPulse, FileSignature } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupMsg, setSetupMsg] = useState('')

  useEffect(() => {
    fetch('/api/setup').then(r => r.json()).then(d => {
      if (d.needs_setup) setNeedsSetup(true)
    }).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal login')
      const from = params.get('from')
      router.push(from || data.redirect || '/')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetup() {
    setSetupLoading(true)
    setSetupMsg('')
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Setup gagal')
      setSetupMsg(data.message)
      setNeedsSetup(false)
      setEmail('admin@wpa.local')
      setPassword(process.env.NEXT_PUBLIC_DEFAULT_ADMIN_PWD || '')
    } catch (e: any) {
      setSetupMsg(e.message)
    } finally {
      setSetupLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left: Brand Panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 text-white p-8 lg:p-12 flex flex-col justify-between min-h-[40vh] lg:min-h-screen">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="font-bold text-xl tracking-tight">WPA</div>
            <div className="text-blue-200 text-xs">PKS BPJS Ketenagakerjaan</div>
          </div>
        </div>
        <div className="my-8 lg:my-0">
          <h1 className="text-3xl lg:text-5xl font-bold leading-tight mb-4">
            Manajemen PKS<br/>Pusat Layanan<br/>Kecelakaan Kerja
          </h1>
          <p className="text-blue-100 text-base lg:text-lg max-w-md">
            Platform terpadu untuk pengelolaan Perjanjian Kerja Sama BPJS Ketenagakerjaan 
            dengan Faskes PLKK — dari onboarding, drafting, adendum, hingga perpanjangan.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <FileSignature className="w-5 h-5 mb-2 text-teal-300" />
              <div className="text-xs font-semibold">PKS & Adendum</div>
              <div className="text-[10px] text-blue-200">Drafting otomatis dari template</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <HeartPulse className="w-5 h-5 mb-2 text-orange-300" />
              <div className="text-xs font-semibold">Onboarding Faskes</div>
              <div className="text-[10px] text-blue-200">Pengajuan → kredensialing → PKS</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <ShieldCheck className="w-5 h-5 mb-2 text-yellow-300" />
              <div className="text-xs font-semibold">Dropping Pusat</div>
              <div className="text-[10px] text-blue-200">Broadcast adendum wajib + deadline</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-blue-200">
          © 2026 BPJS Ketenagakerjaan — Workforce PKS Application
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-slate-50">
        <div className="w-full max-w-md">
          <Card className="border-slate-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-900">Masuk</CardTitle>
              <CardDescription>
                Gunakan akun yang telah dibuatkan oleh Admin Kantor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {needsSetup && (
                <Alert className="mb-4 border-amber-300 bg-amber-50">
                  <AlertDescription className="text-amber-900">
                    <p className="font-semibold mb-2">Setup pertama kali diperlukan</p>
                    <p className="text-sm mb-3">
                      Belum ada akun admin. Klik tombol di bawah untuk membuat admin default 
                      (password dibaca dari env <code className="bg-amber-100 px-1 rounded">DEFAULT_ADMIN_PWD</code>).
                    </p>
                    <Button size="sm" onClick={handleSetup} disabled={setupLoading}>
                      {setupLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Buat Admin Default
                    </Button>
                    {setupMsg && <p className="text-xs mt-2">{setupMsg}</p>}
                  </AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="anda@bpjsketenagakerjaan.go.id"
                    required
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>
                {error && (
                  <Alert className="border-red-300 bg-red-50">
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Masuk
                </Button>
              </form>
              <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500">
                <p className="font-semibold mb-1">Akun default (setelah setup):</p>
                <p>Email: <code className="bg-slate-100 px-1 rounded">admin@wpa.local</code></p>
                <p>Password: diatur via env <code className="bg-slate-100 px-1 rounded">DEFAULT_ADMIN_PWD</code></p>
                <p className="mt-2 text-slate-400">
                  Demi keamanan, ganti password setelah login pertama.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
