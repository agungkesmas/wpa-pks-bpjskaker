import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { error } = await supabaseAdmin.from('wpa_app_settings').select('id').limit(1)
    if (error) throw error
    return NextResponse.json({ status: 'ok', time: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 })
  }
}
