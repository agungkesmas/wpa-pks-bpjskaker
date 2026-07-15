'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/auth-constants'

interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: { label: string; href?: string }[]
}

interface BotReceptionistProps {
  user: {
    id: string
    email: string
    full_name: string
    role: 'super_admin' | 'case_manager' | 'kepala_bidang' | 'penata_pelayanan' | 'pic_rs' | 'legal_rs'
  }
}

const QUICK_ACTIONS: Record<string, { label: string; href: string }[]> = {
  super_admin: [
    { label: 'Tambah user baru', href: '/super_admin/users' },
    { label: 'Upload template PKS', href: '/super_admin/template' },
    { label: 'Lihat audit log', href: '/super_admin/audit' },
  ],
  case_manager: [
    { label: 'Buat PKS baru', href: '/case_manager/pks/new' },
    { label: 'Lihat pengajuan faskes', href: '/case_manager/onboarding' },
    { label: 'Cek dropping pusat', href: '/case_manager/dropping' },
    { label: 'Cek PKS akan habis', href: '/case_manager/perpanjangan' },
  ],
  kepala_bidang: [
    { label: 'Pipeline onboarding', href: '/kepala_bidang/onboarding' },
    { label: 'Approval queue', href: '/kepala_bidang/approval' },
    { label: 'Dropping pusat aktif', href: '/kepala_bidang/dropping' },
  ],
  pic_rs: [
    { label: 'Status PKS saya', href: '/pic_rs/pks' },
    { label: 'Dropping pusat menunggu', href: '/pic_rs/dropping' },
    { label: 'Ajukan perpanjangan', href: '/pic_rs/perpanjangan' },
  ],
  legal_rs: [
    { label: 'PKS menunggu review', href: '/legal_rs/review' },
    { label: 'Dropping pusat menunggu review', href: '/legal_rs/dropping' },
  ],
}

// Fallback rule-based responses (jika Gemini quota habis)
function fallbackResponse(message: string, role: string): { content: string; actions?: { label: string; href?: string }[] } {
  const msg = message.toLowerCase()
  const actions = QUICK_ACTIONS[role as keyof typeof QUICK_ACTIONS] || []
  
  if (/halo|hai|selamat/.test(msg)) {
    return {
      content: `Halo! Saya asisten virtual Mitra PLKK. Senang membantu ${ROLE_LABELS[role as keyof typeof ROLE_LABELS]}. Apa yang bisa saya bantu hari ini?`,
      actions: actions.slice(0, 3),
    }
  }
  if (/pks baru|buat pks|draft pks|pks baru/.test(msg)) {
    return {
      content: 'Untuk membuat PKS baru:\n1. Pastikan data faskes sudah lengkap di Onboarding\n2. Pilih template PKS terbaru\n3. Isi placeholder (sistem auto-fill dari data faskes)\n4. Submit ke review legal\n\nKlik tombol di bawah untuk mulai.',
      actions: [{ label: 'Buat PKS Baru', href: '/case_manager/pks/new' }],
    }
  }
  if (/dropping|pusat|adendum wajib|broadcast/.test(msg)) {
    return {
      content: 'Dropping Pusat adalah adendum wajib dari kantor pusat yang berlaku untuk semua faskes aktif dengan deadline. Case manager akan di-assign otomatis. Cek progress di menu Dropping Pusat.',
      actions: [{ label: 'Lihat Dropping Pusat', href: `/${role}/dropping` }],
    }
  }
  if (/perpanjang|habis|berakhir|kadaluarsa/.test(msg)) {
    return {
      content: 'PKS yang akan berakhir dalam 3 bulan akan ditandai kuning di dashboard. Klik "Perpanjangan" untuk auto-clone data PKS lama — minim entry data.',
      actions: [{ label: 'Cek PKS Akan Habis', href: `/${role}/perpanjangan` }],
    }
  }
  if (/tarif|harga|kewajaran|komparasi/.test(msg)) {
    return {
      content: 'Bank data tarif menyimpan historis tarif per faskes. Saat input tarif baru, sistem otomatis menghitung z-score & percentile untuk deteksi kewajaran (hijau/kuning/merah).',
      actions: [{ label: 'Lihat Komparasi Tarif', href: `/${role}/tarif` }],
    }
  }
  if (/onboarding|faskes baru|pengajuan|kredensialing/.test(msg)) {
    return {
      content: 'Onboarding faskes baru: Pengajuan → Tinjauan Surat → Kredensialing → Negosiasi Tarif → Drafting PKS → Tanda Tangan. Setiap tahap ada notifikasi otomatis.',
      actions: [{ label: 'Lihat Onboarding', href: `/${role}/onboarding` }],
    }
  }
  if (/bantuan|help|apa ini|bagaimana|tutorial/.test(msg)) {
    return {
      content: `Mitra PLKK adalah platform pengelolaan kerjasama BPJS Ketenagakerjaan dengan Faskes PLKK. Sebagai ${ROLE_LABELS[role as keyof typeof ROLE_LABELS]}, Anda bisa:\n• Kelola PKS & adendum\n• Onboarding faskes baru\n• Proses dropping pusat\n• Pembinaan & sosialisasi faskes\n• Komparasi tarif kewajaran\n\nPilih quick action di bawah atau ketik pertanyaan Anda.`,
      actions: actions.slice(0, 4),
    }
  }
  return {
    content: `Saya bisa membantu soal: PKS baru, adendum, dropping pusat, perpanjangan, onboarding faskes, atau komparasi tarif. Silakan tanya lebih spesifik, atau pilih quick action di bawah.`,
    actions: actions.slice(0, 4),
  }
}

export function BotReceptionist({ user }: BotReceptionistProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showGreeting, setShowGreeting] = useState(true)
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Halo ${user.full_name}! 👋 Saya Resepsionis Mitra PLKK. Saya bisa membantu Anda navigasi aplikasi, menjelaskan fitur, atau memandu langkah demi langkah. Apa yang ingin Anda lakukan hari ini?`,
        actions: QUICK_ACTIONS[user.role]?.slice(0, 4) || [],
      }])
    }
  }, [open, user.full_name, user.role, messages.length])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content }])
    setLoading(true)
    
    try {
      const res = await fetch('/api/bot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, role: user.role, history: messages.slice(-10) })
      })
      const data = await res.json()
      setMessages(m => [...m, { 
        role: 'assistant', 
        content: data.content,
        actions: data.actions,
      }])
    } catch (e) {
      // Fallback lokal jika API gagal
      const fb = fallbackResponse(content, user.role)
      setMessages(m => [...m, { role: 'assistant', content: fb.content, actions: fb.actions }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 lg:bottom-6 lg:right-6 z-50 bg-blue-700 hover:bg-blue-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all p-4 flex items-center gap-2 group"
          aria-label="Buka asisten virtual"
        >
          <MessageCircle className="w-5 h-5" />
          {showGreeting && (
            <span className="hidden sm:block text-sm font-medium pr-2 max-w-0 group-hover:max-w-xs overflow-hidden whitespace-nowrap transition-all">
              Butuh bantuan?
            </span>
          )}
          <Sparkles className="w-3 h-3 text-yellow-300 absolute -top-1 -right-1" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 lg:bottom-6 lg:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-teal-600 text-white p-3 rounded-t-xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Resepsionis Mitra PLKK</div>
                <div className="text-[10px] opacity-80">Asisten virtual · Online</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  m.role === 'user' 
                    ? 'bg-blue-700 text-white' 
                    : 'bg-white border border-slate-200 text-slate-800'
                )}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {m.actions.map((a, j) => (
                        <button
                          key={j}
                          onClick={() => a.href && router.push(a.href)}
                          className="text-xs text-left bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1.5 rounded border border-blue-200 transition-colors"
                        >
                          → {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Mengetik...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-slate-200 flex gap-2 bg-white rounded-b-xl flex-shrink-0">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
              placeholder="Ketik pertanyaan..."
              disabled={loading}
              className="flex-1"
            />
            <Button size="icon" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
