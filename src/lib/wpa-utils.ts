// Utility functions yang aman untuk di-share antara server & client.
// JANGAN import next/headers atau server-only modules di sini.

// Generate strong password (charset avoids I/L/O/0/1 to prevent confusion)
export function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*'
  let pwd = ''
  for (let i = 0; i < length; i++) {
    pwd += charset[Math.floor(Math.random() * charset.length)]
  }
  return pwd
}

export function generateUsername(prefix: string): string {
  const charset = 'abcdefghijkmnpqrstuvwxyz23456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += charset[Math.floor(Math.random() * charset.length)]
  }
  return `${prefix.charAt(0).toLowerCase()}${suffix}`
}

// Format rupiah
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

// Format tanggal Indonesia
export function formatTanggal(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('id-ID', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

// Hitung hari sampai deadline
export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null
  const target = new Date(date)
  if (isNaN(target.getTime())) return null
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// Reminder color berdasarkan hari tersisa
export function getReminderColor(daysLeft: number): { 
  color: string
  label: string
  bg: string
  border: string
} {
  if (daysLeft < 0) return { 
    color: 'text-red-700', 
    label: 'Lewat', 
    bg: 'bg-red-50', 
    border: 'border-red-300' 
  }
  if (daysLeft <= 14) return { 
    color: 'text-red-700', 
    label: '2 minggu', 
    bg: 'bg-red-50', 
    border: 'border-red-300' 
  }
  if (daysLeft <= 30) return { 
    color: 'text-orange-700', 
    label: '1 bulan', 
    bg: 'bg-orange-50', 
    border: 'border-orange-300' 
  }
  if (daysLeft <= 90) return { 
    color: 'text-yellow-700', 
    label: '3 bulan', 
    bg: 'bg-yellow-50', 
    border: 'border-yellow-300' 
  }
  return { 
    color: 'text-green-700', 
    label: 'Aman', 
    bg: 'bg-green-50', 
    border: 'border-green-300' 
  }
}
