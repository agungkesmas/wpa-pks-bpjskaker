import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// GET /api/dropping-pusat/faskes-list
// Returns list of active faskes in CM/Kabid's cabang for the dropping-pusat checklist UI.
// Only faskes with status='aktif' (PKS signed) are eligible — others are auto-excluded.
export async function GET() {
  try {
    const me = await getSession()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'case_manager' && me.role !== 'kepala_bidang' && me.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya CM/Kabid/SuperAdmin yang bisa akses' }, { status: 403 })
    }
    if (!me.kantor_cabang_id) {
      return NextResponse.json({ error: 'Akun tidak terikat kantor cabang' }, { status: 400 })
    }

    // Get all faskes in this cabang with active PKS (status='aktif' or PKS signed)
    const { data: faskesList, error } = await supabaseAdmin
      .from('wpa_faskes')
      .select(`
        id,
        nama,
        jenis,
        tipe,
        kota,
        status,
        wpa_pks(id, kode_pks_pihak_pertama, tanggal_berakhir, status)
      `)
      .eq('kantor_cabang_id', me.kantor_cabang_id)
      .order('nama', { ascending: true })

    if (error) throw error

    // Filter: only faskes with at least one signed PKS (status='ditandatangani')
    // — Dropping pusat only applies to faskes that already have a PKS.
    const eligible = (faskesList || [])
      .map(f => {
        const pksList = (f.wpa_pks || []) as any[]
        const activePks = pksList.find((p: any) => p.status === 'ditandatangani')
        return {
          id: f.id,
          nama: f.nama,
          jenis: f.jenis,
          tipe: f.tipe,
          kota: f.kota,
          status: f.status,
          pks_id: activePks?.id || null,
          pks_kode: activePks?.kode_pks_pihak_pertama || null,
          pks_berakhir: activePks?.tanggal_berakhir || null,
          has_active_pks: !!activePks,
        }
      })
      .filter(f => f.has_active_pks)

    return NextResponse.json({
      data: eligible,
      total: eligible.length,
      kantor_cabang_id: me.kantor_cabang_id,
    })
  } catch (e: any) {
    console.error('Dropping pusat faskes-list error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
