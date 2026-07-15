'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, Building2, User, Wallet, FileText, Info, Calendar, Plus, RefreshCw, FileEdit, ArrowRight, Upload } from 'lucide-react'
import { toast } from 'sonner'

interface MasalTemplate {
  id: string
  kode: string
  nama: string
  version: string
  judul_kartu: string | null
  is_masal: boolean
  uploaded_at: string
}

export default function AjukanPage() {
  const router = useRouter()

  const [masalTemplates, setMasalTemplates] = useState<MasalTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  useEffect(() => {
    fetchMasalTemplates()
  }, [])

  async function fetchMasalTemplates() {
    try {
      const res = await fetch('/api/adendum-masal/list-templates')
      const data = await res.json()
      if (res.ok) {
        setMasalTemplates(data.data || [])
      }
    } catch (e) {
      console.error('Fetch templates error:', e)
    } finally {
      setLoadingTemplates(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Buat Pengajuan</h1>
        <p className="text-sm text-slate-600">
          Pilih jenis pengajuan sesuai kebutuhan Anda. Untuk PKS Baru, mohon hubungi Case Manager BPJS.
        </p>
      </div>

      {/* Main 3 Cards */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pengajuan Individu</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* PKS Baru — disabled for PIC RS */}
          <Card className="border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed">
            <CardContent className="p-4 text-center">
              <Plus className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <div className="font-semibold text-sm text-slate-600">PKS Baru</div>
              <div className="text-xs text-slate-500 mt-1 mb-2">
                Faskes baru kerjasama
              </div>
              <Badge variant="outline" className="text-[10px]">Hubungi CM</Badge>
              <p className="text-[10px] text-slate-500 mt-2">
                CM yang handle end-to-end: input faskes + upload dokumen + buat akun PIC RS
              </p>
            </CardContent>
          </Card>

          {/* Perpanjangan */}
          <Link href="/pic_rs/ajukan-baru/perpanjangan">
            <Card className="cursor-pointer transition-all border-blue-200 hover:border-blue-400 hover:bg-blue-50/30">
              <CardContent className="p-4 text-center">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="font-semibold text-sm text-slate-900">Perpanjangan PKS</div>
                <div className="text-xs text-slate-500 mt-1 mb-2">
                  PKS akan berakhir (≤3 bulan)
                </div>
                <Badge className="bg-blue-100 text-blue-800 text-[10px]">2 file wajib</Badge>
                <p className="text-[10px] text-slate-500 mt-2">
                  Surat permohonan + tarif diajukan
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Adendum */}
          <Link href="/pic_rs/ajukan-baru/adendum">
            <Card className="cursor-pointer transition-all border-purple-200 hover:border-purple-400 hover:bg-purple-50/30">
              <CardContent className="p-4 text-center">
                <FileEdit className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="font-semibold text-sm text-slate-900">Adendum</div>
                <div className="text-xs text-slate-500 mt-1 mb-2">
                  Ubah tarif, layanan, atau data
                </div>
                <div className="text-[10px] text-slate-500 mt-2 space-y-0.5">
                  <div>• Tarif (3 file)</div>
                  <div>• Layanan Baru (3 file)</div>
                  <div>• Perubahan Data (2 file)</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Adendum Masal Cards (dynamic from templates) */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Adendum Masal (dari Kantor Pusat)
        </h3>
        {loadingTemplates ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : masalTemplates.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Belum ada adendum masal aktif</p>
              <p className="text-xs text-slate-400 mt-1">
                Kartu coklat akan muncul otomatis di sini saat Super Admin upload template masal.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {masalTemplates.map(tpl => (
              <Link key={tpl.id} href={`/pic_rs/adendum-masal/${tpl.id}`}>
                <Card className="cursor-pointer transition-all border-amber-300 bg-amber-50/40 hover:border-amber-500 hover:bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-900 leading-tight">
                          {tpl.judul_kartu || tpl.nama}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {tpl.kode} · v{tpl.version}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-amber-900 mt-2 flex items-center gap-1">
                      Klik untuk ajukan
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Help banner */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-700" />
        <AlertDescription className="text-blue-900">
          <strong>Butuh bantuan?</strong> Hubungi Case Manager di kantor cabang Anda untuk:
          <ul className="text-xs mt-1 ml-4 list-disc">
            <li>Pengajuan PKS Baru (CM yang handle end-to-end)</li>
            <li>Pertanyaan tentang adendum masal dari kantor pusat</li>
            <li>Kendala upload dokumen atau pengisian form</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}
