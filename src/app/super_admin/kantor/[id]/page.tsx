import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { KantorDetailManager } from '@/components/wpa/KantorDetailManager'

export default async function KantorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSession()
  if (!me) return notFound()
  
  const { id } = await params
  
  // admin_kantor hanya lihat cabangnya
  if (me.role === 'admin_kantor' && me.kantor_cabang_id !== id) {
    return notFound()
  }
  
  const { data: kantor, error } = await supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !kantor) return notFound()
  
  // Get users
  const { data: users } = await supabaseAdmin
    .from('wpa_users')
    .select(`
      id, email, full_name, role, phone, nip, profile_photo_url, is_active, 
      last_login_at, created_at, must_change_password
    `)
    .eq('kantor_cabang_id', id)
    .order('role')
    .order('full_name')
  
  // Get mutasi pending for users in this kantor
  const userIds = (users || []).map(u => u.id)
  let mutasiMap: Record<string, any> = {}
  if (userIds.length > 0) {
    const { data: mutasi } = await supabaseAdmin
      .from('wpa_user_mutasi')
      .select('user_id, to_kantor_cabang_id, tanggal_efektif, status, nomor_sk')
      .in('user_id', userIds)
      .eq('status', 'pending')
    mutasiMap = (mutasi || []).reduce((acc, m) => {
      acc[m.user_id] = m
      return acc
    }, {} as Record<string, any>)
  }
  
  const usersEnriched = (users || []).map(u => ({
    ...u,
    mutasi_pending: mutasiMap[u.id] || null,
  }))
  
  // Get faskes
  const { data: faskes } = await supabaseAdmin
    .from('wpa_faskes')
    .select('id, nama, jenis, tipe, status, alamat, kota, group_id, wpa_faskes_group(nama)')
    .eq('kantor_cabang_id', id)
    .order('nama')
  
  // Get all kantor for mutasi target dropdown
  const { data: allKantor } = await supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('id, nama, kode')
    .neq('id', id)
    .eq('is_active', true)
    .order('nama')
  
  // Stats
  const [pksAktif, pksDraft, pksBerakhir] = await Promise.all([
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', id).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', id).in('status', ['draft', 'negosiasi', 'review_legal']),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', id).eq('status', 'berakhir'),
  ])
  
  return (
    <div className="space-y-6">
      <KantorDetailManager
        kantor={kantor}
        users={usersEnriched}
        faskes={faskes || []}
        allKantor={allKantor || []}
        stats={{
          users: usersEnriched.filter(u => u.is_active).length,
          faskes: (faskes || []).filter(f => f.status === 'aktif').length,
          pks_aktif: pksAktif.count || 0,
          pks_draft: pksDraft.count || 0,
          pks_berakhir: pksBerakhir.count || 0,
        }}
        canEdit={me.role === 'super_admin' || me.role === 'admin_kantor'}
        canCreateUser={me.role === 'super_admin' || me.role === 'admin_kantor'}
      />
    </div>
  )
}
