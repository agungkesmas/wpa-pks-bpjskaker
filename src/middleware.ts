import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/setup', '/api/health']
const PUBLIC_PREFIXES = ['/api/auth/', '/_next/', '/favicon.ico', '/logo.svg', '/robots.txt']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check session cookie
  const token = req.cookies.get('wpa_session')?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // Add security headers
  const res = NextResponse.next()
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  // Cache strategy: HTML authenticated = no-store; API = short private cache (browser back/forward OK)
  // (sebelumnya semua di-no-store, bikin browser re-fetch semua data navigasi)
  if (pathname.startsWith('/api/')) {
    res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=30')
  } else {
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)'],
}
