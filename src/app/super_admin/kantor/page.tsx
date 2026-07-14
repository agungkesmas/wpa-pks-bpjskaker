import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { KantorCabangManager } from '@/components/wpa/KantorCabangManager'

export default async function KantorListPage() {
  const me = await getSession()
  if (!me) return null
  
  // Get kantor list
  let query = supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('*')
    .order('nama')
  
  // admin_kantor hanya lihat cabangnya
  if (me.role === 'admin_kantor' && me.kantor_cabang_id) {
    query = query.eq('id', me.kantor_cabang_id)
  }
  
  const { data: kantorList } = await query
  
  // Get stats per kantor
  const kantorWithStats = await Promise.all((kantorList || []).map(async k => {
    const [users, faskes, pksAktif] = await Promise.all([
      supabaseAdmin.from('wpa_users').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('is_active', true),
      supabaseAdmin.from('wpa_faskes').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('status', 'aktif'),
      supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', k.id).eq('status', 'ditandatangani'),
    ])
    return {
      ...k,
      stats: {
        users: users.count || 0,
        faskes: faskes.count || 0,
        pks_aktif: pksAktif.count || 0,
      }
    }
  }))
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kantor Cabang</h1>
        <p className="text-sm text-slate-600">
          Klik kantor cabang untuk mengelola user, faskes, dan statistik.
          {me.role === 'super_admin' && ' Anda dapat membuat kantor cabang baru.'}
        </p>
      </div>
      <KantorCabangManager 
        kantorList={kantorWithStats} 
        canCreate={me.role === 'super_admin'}
      />
    </div>
  )
}
