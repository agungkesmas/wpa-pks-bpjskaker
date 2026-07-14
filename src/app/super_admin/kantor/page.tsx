import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Users, ShieldCheck, Plus, MapPin, Phone, ChevronRight } from 'lucide-react'

export default async function KantorListPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: kantorList } = await supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('*')
    .order('nama')
  
  const kantorWithStats = await Promise.all((kantorList || []).map(async k => {
    const [users, faskes, pksAktif] = await Promise.all([
      supabaseAdmin.from('wpa_users').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('is_active', true),
      supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('status', 'aktif'),
      supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('status', 'ditandatangani'),
    ])
    return {
      ...k,
      stats: { users: users.count || 0, faskes: faskes.count || 0, pks_aktif: pksAktif.count || 0 }
    }
  }))
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kantor Cabang</h1>
        <p className="text-sm text-slate-600">Klik kantor cabang untuk mengelola user, faskes, dan statistik.</p>
      </div>
      {kantorWithStats.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Belum ada kantor cabang terdaftar</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kantorWithStats.map(k => (
            <Link key={k.id} href={`/super_admin/kantor/${k.id}`}>
              <Card className="hover:shadow-lg hover:border-rose-300 transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-700 to-rose-900 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <Badge variant={k.is_active ? 'default' : 'destructive'} className={k.is_active ? 'bg-green-100 text-green-800' : ''}>
                      {k.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base mb-1 line-clamp-2">{k.nama}</h3>
                  <p className="text-xs text-slate-500 mb-3 font-mono">{k.kode}</p>
                  {k.alamat && (
                    <div className="text-xs text-slate-600 mb-2 flex items-start gap-1">
                      <MapPin className="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
                      <span className="line-clamp-2">{k.alamat}{k.kota ? `, ${k.kota}` : ''}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
                    <div className="text-center">
                      <div className="text-lg font-bold text-slate-900">{k.stats.users}</div>
                      <div className="text-[10px] text-slate-500">User</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-slate-900">{k.stats.faskes}</div>
                      <div className="text-[10px] text-slate-500">Faskes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-700">{k.stats.pks_aktif}</div>
                      <div className="text-[10px] text-slate-500">PKS</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end text-rose-700 text-xs font-semibold">
                    Kelola <ChevronRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
