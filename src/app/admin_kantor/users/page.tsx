import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { UserManagement } from '@/components/wpa/UserManagement'

export default async function UsersPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: users } = await supabaseAdmin
    .from('wpa_users')
    .select('id, email, full_name, role, phone, is_active, last_login_at, created_at, wpa_kantor_cabang(nama), wpa_faskes(nama)')
    .order('created_at', { ascending: false })
  
  const { data: kantorList } = await supabaseAdmin
    .from('wpa_kantor_cabang')
    .select('id, nama, kode')
    .eq('is_active', true)
    .order('nama')
  
  const { data: faskesList } = await supabaseAdmin
    .from('wpa_faskes')
    .select('id, nama, jenis')
    .order('nama')
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manajemen User</h1>
        <p className="text-sm text-slate-600">Buat & kelola akun untuk semua role (case manager, kepala bidang, PIC RS, legal RS, admin).</p>
      </div>
      <UserManagement 
        users={users || []} 
        kantorList={kantorList || []} 
        faskesList={faskesList || []}
        currentUserId={me.id}
      />
    </div>
  )
}
