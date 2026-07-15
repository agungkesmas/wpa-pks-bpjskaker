import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Cron job: apply scheduled mutasi yang sudah due
// Vercel Cron panggil endpoint ini setiap hari jam 8 pagi (WIB)
// Konfigurasi di vercel.json: { "path": "/api/cron/mutasi", "schedule": "0 1 * * *" } (UTC 01:00 = WIB 08:00)

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel mengirim header x-vercel-cron)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Get all pending mutasi with tanggal_efektif <= today
    const { data: dueMutasi, error } = await supabaseAdmin
      .from('wpa_user_mutasi')
      .select('*')
      .eq('status', 'pending')
      .lte('tanggal_efektif', today)
    
    if (error) throw error
    
    let appliedCount = 0
    let failedCount = 0
    const errors: string[] = []
    
    for (const m of dueMutasi || []) {
      try {
        // Apply mutasi: update user.kantor_cabang_id
        const { error: updErr } = await supabaseAdmin
          .from('wpa_users')
          .update({ 
            kantor_cabang_id: m.to_kantor_cabang_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', m.user_id)
        if (updErr) throw updErr
        
        // Update mutasi status
        await supabaseAdmin
          .from('wpa_user_mutasi')
          .update({ 
            status: 'active', 
            processed_at: new Date().toISOString(),
          })
          .eq('id', m.id)
        
        // Notify user
        await supabaseAdmin.from('wpa_notifications').insert({
          user_id: m.user_id,
          kantor_cabang_id: m.to_kantor_cabang_id,
          type: 'mutasi_applied',
          title: 'Mutasi Diterapkan',
          body: `Mutasi Anda telah diterapkan efektif hari ini (${today}).`,
          related_entity: 'mutasi',
          related_id: m.id,
        })
        
        appliedCount++
      } catch (e: any) {
        failedCount++
        errors.push(`User ${m.user_id}: ${e.message}`)
      }
    }
    
    return NextResponse.json({ 
      success: true,
      processed_at: new Date().toISOString(),
      due_count: dueMutasi?.length || 0,
      applied: appliedCount,
      failed: failedCount,
      errors: errors.slice(0, 10),
    })
  } catch (e: any) {
    console.error('Cron mutasi error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
