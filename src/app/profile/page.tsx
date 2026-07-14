import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ProfileManager } from '@/components/wpa/ProfileManager'
import { ROLE_LABELS } from '@/lib/auth-constants'

export default async function ProfilePage() {
  const me = await getSession()
  if (!me) return notFound()
  
  // Get full user info
  const { data: user } = await supabaseAdmin
    .from('wpa_users')
    .select(`
      id, email, full_name, role, phone, nip, profile_photo_url, 
      is_active, last_login_at, created_at, must_change_password,
      wpa_kantor_cabang(nama, kode),
      wpa_user_faskes(is_primary, wpa_faskes(id, nama, jenis, tipe, kota))
    `)
    .eq('id', me.id)
    .single()
  
  if (!user) return notFound()
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profil Saya</h1>
        <p className="text-sm text-slate-600">
          Kelola akun Anda — ubah password, foto, kontak. Field yang butuh approval admin (nama, role, kantor) tidak bisa diubah sendiri.
        </p>
      </div>
      <ProfileManager user={user} />
    </div>
  )
}
