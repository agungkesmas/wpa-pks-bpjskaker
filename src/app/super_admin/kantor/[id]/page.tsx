import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { KantorDetailManager } from '@/components/wpa/KantorDetailManager'

export default async function KantorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSession()
  if (!me) return notFound()
  const { id } = await params
  
  const { data: kantor } = await supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('*')
    .eq('id', id)
    .single()
  if (!kantor) return notFound()
  
  const { data: users } = await supabaseAdmin
    .from('wpa_users')
    .select('id, email, full_name, role, phone, nip, profile_photo_url, is_active, last_login_at, created_at, must_change_password')
    .eq('kantor_cabang_id', id)
    .order('role').order('full_name')
  
  const { data: faskes } = await supabaseAdmin
    .from('wpa_faskes')
    .select('id, nama, jenis, tipe, status, alamat, kota')
    .eq('kantor_cabang_id', id)
    .order('nama')
  
  const { data: allKantor } = await supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('id, nama, kode')
    .neq('id', id)
    .eq('is_active', true)
    .order('nama')
  
  const [pksAktif, pksDraft] = await Promise.all([
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', id).eq('status', 'ditandatangani'),
    supabaseAdmin.from('wpa_pks').select('*', { count: 'exact', head: true }).eq('kantor_cabang_id', id).in('status', ['draft', 'negosiasi', 'review_legal']),
  ])
  
  return (
    <KantorDetailManager
      kantor={kantor}
      users={users || []}
      faskes={faskes || []}
      allKantor={allKantor || []}
      stats={{
        users: (users || []).filter(u => u.is_active).length,
        faskes: (faskes || []).filter(f => f.status === 'aktif').length,
        pks_aktif: pksAktif.count || 0,
        pks_draft: pksDraft.count || 0,
        pks_berakhir: 0,
      }}
      canEdit={me.role === 'super_admin'}
      canCreateUser={me.role === 'super_admin'}
    />
  )
}
