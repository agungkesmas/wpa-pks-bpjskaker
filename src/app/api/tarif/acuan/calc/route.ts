import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Helper: hitung statistik dari sample (preview sebelum save)
function calcStats(samples: { rs_nama: string; tarif: number }[]) {
  if (!samples || samples.length === 0) {
    return { error: 'Sample kosong' }
  }
  const tarifs = samples.map(s => s.tarif).sort((a, b) => a - b)
  const n = tarifs.length
  const sum = tarifs.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const median = n % 2 === 0 ? (tarifs[n/2 - 1] + tarifs[n/2]) / 2 : tarifs[Math.floor(n/2)]
  const variance = n > 1 ? tarifs.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / (n - 1) : 0
  const std_dev = Math.sqrt(variance)
  return {
    sample_count: n,
    tarif_min: tarifs[0],
    tarif_max: tarifs[n - 1],
    tarif_mean: Math.round(mean),
    tarif_median: Math.round(median),
    tarif_std_dev: Math.round(std_dev * 100) / 100,
    tarif_acuan: Math.round(mean),  // mean dipakai sebagai acuan
    samples: tarifs,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const samples = body.samples
    if (!Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json({ error: 'samples wajib array of {rs_nama, tarif}' }, { status: 400 })
    }
    
    // Validate
    for (const s of samples) {
      if (!s.rs_nama || typeof s.tarif !== 'number' || s.tarif <= 0) {
        return NextResponse.json({ 
          error: `Sample invalid: ${JSON.stringify(s)}. Format: {rs_nama: string, tarif: number > 0}` 
        }, { status: 400 })
      }
    }
    
    const stats = calcStats(samples)
    return NextResponse.json({ success: true, stats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
