import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

const ROLE_CONTEXT: Record<string, string> = {
  admin_kantor: 'Admin Kantor (root) — mengelola user, kantor cabang, template PKS, bank tarif, audit log, pengaturan aplikasi.',
  case_manager: 'Case Manager BPJS Ketenagakerjaan — eksekusi harian: onboarding faskes, drafting PKS, adendum, dropping pusat, perpanjangan.',
  kepala_bidang: 'Kepala Bidang Pelayanan BPJS Ketenagakerjaan — monitoring strategis, approval, pipeline onboarding, analisis tarif.',
  pic_rs: 'PIC RS (Faskes) — respon ke BPJS, upload dokumen kredensial, ajukan perpanjangan/adendum, lihat status PKS.',
  legal_rs: 'Legal / Pimpinan RS — review legal PKS & adendum, approve/reject, tanda tangan.',
}

const APP_CONTEXT = `
Konteks Aplikasi Mitra PLKK — Platform pengelolaan kerjasama BPJS Ketenagakerjaan dengan Faskes PLKK:
- Tujuan: manajemen PKS PLKK (Pusat Layanan Kecelakaan Kerja) antara BPJS Ketenagakerjaan dengan Faskes.
- Fitur utama:
  1. Onboarding Faskes Baru: pengajuan → tinjauan surat → kredensialing (checklist SIP/STR/Akta/Izin) → negosiasi tarif → drafting PKS → tanda tangan.
  2. PKS Baru: dari template .docx, parsing {{PLACEHOLDER}} otomatis, form input, generate DOCX/PDF.
  3. Adendum Adaptif: deteksi perubahan template baru dari kantor pusat, diff placeholder/pasal otomatis.
  4. Adendum Harga Faskes: faskes ajukan perubahan tarif, sistem auto-bandingkan dengan bank data + kewajaran.
  5. Adendum Dropping Pusat: broadcast wajib ke SEMUA faskes aktif + deadline. Auto-assign ke case_manager. Cron job kirim reminder H-7/H-3/H-1.
  6. Perpanjangan PKS: auto-clone data dari PKS sebelumnya, minim entry. Reminder 3 bulan sebelum habis dengan flag warna (hijau/kuning/oranye/merah).
  7. Bank Data Tarif + Komparasi Kewajaran: statistik min/max/mean/median/P5/P95/std_dev, z-score, boxplot.
  8. 5 role: admin_kantor, case_manager, kepala_bidang, pic_rs, legal_rs.
- Aturan jawaban: ramah, ringkas (max 3 paragraf), gunakan bahasa Indonesia, fokus solusi konkret. Jika user tanya langkah, jawab step-by-step.
`

function fallbackResponse(message: string, role: string) {
  const msg = message.toLowerCase()
  const actionsByRole: Record<string, { label: string; href: string }[]> = {
    admin_kantor: [
      { label: 'Tambah user baru', href: '/admin_kantor/users' },
      { label: 'Upload template PKS', href: '/admin_kantor/templates' },
    ],
    case_manager: [
      { label: 'Buat PKS baru', href: '/case_manager/pks/new' },
      { label: 'Lihat pengajuan faskes', href: '/case_manager/onboarding' },
      { label: 'Cek dropping pusat', href: '/case_manager/dropping' },
    ],
    kepala_bidang: [
      { label: 'Pipeline onboarding', href: '/kepala_bidang/onboarding' },
      { label: 'Approval queue', href: '/kepala_bidang/approval' },
    ],
    pic_rs: [
      { label: 'Status PKS saya', href: '/pic_rs/pks' },
      { label: 'Ajukan perpanjangan', href: '/pic_rs/perpanjangan' },
    ],
    legal_rs: [
      { label: 'PKS menunggu review', href: '/legal_rs/review' },
      { label: 'Dropping pusat review', href: '/legal_rs/dropping' },
    ],
  }
  const actions = actionsByRole[role] || []
  
  if (/halo|hai|selamat/.test(msg)) {
    return { content: `Halo! Saya asisten virtual Mitra PLKK. Senang membantu Anda. Apa yang bisa saya bantu hari ini?`, actions: actions.slice(0, 3) }
  }
  if (/pks baru|buat pks|draft pks/.test(msg)) {
    return { 
      content: 'Untuk membuat PKS baru:\n1. Pastikan data faskes sudah lengkap\n2. Pilih template PKS terbaru\n3. Isi placeholder (sistem auto-fill dari data faskes)\n4. Submit ke review legal',
      actions: [{ label: 'Buat PKS Baru', href: '/case_manager/pks/new' }],
    }
  }
  if (/dropping|pusat|adendum wajib/.test(msg)) {
    return {
      content: 'Dropping Pusat adalah adendum wajib dari kantor pusat ke semua faskes aktif dengan deadline. Sistem auto-assign ke case manager dan kirim reminder H-7/H-3/H-1.',
      actions: [{ label: 'Lihat Dropping Pusat', href: `/${role}/dropping` }],
    }
  }
  if (/perpanjang|habis|berakhir/.test(msg)) {
    return {
      content: 'PKS yang akan berakhir ≤3 bulan ditandai kuning di dashboard. Klik "Perpanjangan" untuk auto-clone data PKS lama.',
      actions: [{ label: 'Cek PKS Akan Habis', href: `/${role}/perpanjangan` }],
    }
  }
  if (/tarif|harga|kewajaran/.test(msg)) {
    return {
      content: 'Bank data tarif menyimpan historis tarif per faskes. Saat input tarif baru, sistem otomatis hitung z-score & percentile untuk deteksi kewajaran (hijau/kuning/merah).',
      actions: [{ label: 'Lihat Komparasi Tarif', href: `/${role}/tarif` }],
    }
  }
  return {
    content: `Saya bisa membantu soal: PKS baru, adendum, dropping pusat, perpanjangan, onboarding faskes, atau komparasi tarif. Pilih quick action atau tanya lebih spesifik.`,
    actions: actions.slice(0, 4),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = (body.message || '').toString().trim()
    const role = (body.role || 'case_manager').toString()
    const history = Array.isArray(body.history) ? body.history.slice(-10) : []
    
    if (!message) {
      return NextResponse.json({ error: 'Pesan kosong' }, { status: 400 })
    }
    
    if (!GEMINI_API_KEY) {
      const fb = fallbackResponse(message, role)
      return NextResponse.json(fb)
    }
    
    try {
      const roleContext = ROLE_CONTEXT[role] || ROLE_CONTEXT.case_manager
      const systemPrompt = `${APP_CONTEXT}\n\nAnda adalah Resepsionis Mitra PLKK — asisten virtual yang membantu pengguna aplikasi.\nKonteks user saat ini: ${roleContext}\n\nJawab singkat (max 3 paragraf), ramah, dalam Bahasa Indonesia. Jika user tanya langkah, jawab step-by-step dengan nomor.`
      
      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Baik, saya siap membantu.' }] },
        ...history.map((m: any) => ({ 
          role: m.role === 'assistant' ? 'model' : 'user', 
          parts: [{ text: m.content }] 
        })),
        { role: 'user', parts: [{ text: message }] },
      ]
      
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 500 } }),
        }
      )
      
      if (!geminiRes.ok) {
        throw new Error(`Gemini API ${geminiRes.status}`)
      }
      
      const data = await geminiRes.json()
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
      if (!content) throw new Error('Empty Gemini response')
      
      const fb = fallbackResponse(message, role)
      return NextResponse.json({ 
        content: content.trim(), 
        actions: fb.actions 
      })
    } catch (e: any) {
      console.error('Gemini error, fallback:', e.message)
      const fb = fallbackResponse(message, role)
      return NextResponse.json(fb)
    }
  } catch (e: any) {
    console.error('Bot error:', e)
    return NextResponse.json({ 
      content: 'Maaf, terjadi kesalahan. Silakan coba lagi atau hubungi admin.',
      actions: []
    }, { status: 500 })
  }
}
