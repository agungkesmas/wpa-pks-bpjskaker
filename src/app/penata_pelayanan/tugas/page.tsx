'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Building2, Clock, AlertCircle, ChevronRight, Calendar } from 'lucide-react'

interface Pipeline {
  id: string
  jenis: string
  current_tahap: string
  status: string
  sla_deadline: string | null
  sla_breached: boolean
  wpa_faskes: { nama: string; jenis: string; kota: string } | null
}

const TAHAP_LABELS: Record<string, string> = {
  diajukan: 'Pengajuan',
  ditinjau: 'Peninjauan',
  kredensialing: 'Kredensialing',
  negosiasi_tarif: 'Negosiasi Tarif',
  drafting_pks: 'Drafting PKS',
  drafting_adendum: 'Drafting Adendum',
  approval_kabid: 'Approval Kabid',
  review_legal_rs: 'Review Legal RS',
  tanda_tangan: 'Tanda Tangan',
}

export default function PPTugasSayaPage() {
  const router = useRouter()
  const [list, setList] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchList() {
      try {
        const res = await fetch('/api/pipeline/list?handler_only=true')
        const data = await res.json()
        setList(data.data || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchList()
  }, [])
  
  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tugas Saya</h1>
        <p className="text-sm text-slate-600">Tugas yang sedang Anda pegang (yang sudah Anda Ambil Alih).</p>
      </div>
      
      {list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Belum ada tugas yang Anda pegang</p>
            <p className="text-xs text-slate-400 mt-1">Cek "Tugas Cabang" untuk lihat tugas yang dibuka CM/Kabid</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map(p => {
            const daysLeft = p.sla_deadline ? Math.ceil((new Date(p.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/penata_pelayanan/tugas/detail?id=${p.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-cyan-600" />
                        <span className="font-semibold text-slate-900">{p.wpa_faskes?.nama || 'Faskes'}</span>
                        <Badge variant="outline">{p.jenis.replace(/_/g, ' ').toUpperCase()}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 mb-2">
                        {p.wpa_faskes?.jenis} · {p.wpa_faskes?.kota}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800">{TAHAP_LABELS[p.current_tahap] || p.current_tahap}</Badge>
                        {p.sla_deadline && (
                          <span className={`text-xs flex items-center gap-1 ${p.sla_breached || (daysLeft !== null && daysLeft < 0) ? 'text-red-700 font-semibold' : daysLeft !== null && daysLeft <= 3 ? 'text-orange-700' : 'text-slate-500'}`}>
                            <Calendar className="w-3 h-3" />
                            {daysLeft !== null && daysLeft >= 0 ? `SLA ${daysLeft}h` : 'SLA lewat'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
