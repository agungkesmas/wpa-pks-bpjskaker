'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileSignature, Building2, Users, Settings,
  LogOut, Menu, X, Bell, Calendar, BarChart3,
  FileText, ListChecks, Wallet, ChevronRight, ChevronLeft, ShieldCheck,
  Inbox, Plus, Briefcase, FolderOpen, FileEdit, ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ROLE_LABELS, type UserRole } from '@/lib/auth-constants'

// Lazy load BotReceptionist
const BotReceptionist = dynamic(
  () => import('@/components/bot/BotReceptionist').then(m => ({ default: m.BotReceptionist })),
  { ssr: false, loading: () => null }
)

export interface RoleShellProps {
  user: {
    id: string
    email: string
    full_name: string
    role: UserRole
    kantor_cabang_id: string | null
    faskes_id: string | null
  }
  kantor_nama?: string
  notifications?: { id: string; title: string; body: string; created_at: string }[]
  children: React.ReactNode
}

const ROLE_THEMES: Record<UserRole, { sidebar: string; accent: string; text: string; active: string }> = {
  super_admin:      { sidebar: 'bg-rose-900',  accent: 'bg-rose-700',  text: 'text-rose-100',  active: 'bg-rose-700 text-white' },
  kepala_bidang:    { sidebar: 'bg-teal-900',  accent: 'bg-teal-700',  text: 'text-teal-100',  active: 'bg-teal-700 text-white' },
  case_manager:     { sidebar: 'bg-blue-900',  accent: 'bg-blue-700',  text: 'text-blue-100',  active: 'bg-blue-700 text-white' },
  penata_pelayanan: { sidebar: 'bg-cyan-800',  accent: 'bg-cyan-600',  text: 'text-cyan-100',  active: 'bg-cyan-600 text-white' },
  pic_rs:           { sidebar: 'bg-orange-800',accent: 'bg-orange-600',text: 'text-orange-100',active: 'bg-orange-600 text-white' },
  legal_rs:         { sidebar: 'bg-purple-900',accent: 'bg-purple-700',text: 'text-purple-100',active: 'bg-purple-700 text-white' },
}

// Menu with optional sub-items
interface NavItem {
  href: string
  label: string
  icon: any
  children?: { href: string; label: string }[]
}

const ROLE_NAV: Record<UserRole, NavItem[]> = {
  super_admin: [
    { href: '/super_admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/super_admin/kantor', label: 'Kantor Cabang', icon: Building2 },
    { href: '/super_admin/users', label: 'Semua User', icon: Users },
    { href: '/super_admin/template', label: 'Template Mandatori', icon: FileText },
    { href: '/super_admin/pengajuan', label: 'Pengajuan', icon: Inbox },
    { href: '/super_admin/audit', label: 'Audit Log', icon: ListChecks },
    { href: '/super_admin/settings', label: 'Settings', icon: Settings },
  ],
  kepala_bidang: [
    { href: '/kepala_bidang', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/kepala_bidang/tugas', label: 'Tugas Cabang', icon: Briefcase, children: [
      { href: '/kepala_bidang/tugas', label: 'Semua Tugas' },
      { href: '/kepala_bidang/approval', label: 'Approval' },
      { href: '/kepala_bidang/dropping', label: 'Dropping Pusat' },
    ]},
    { href: '/kepala_bidang/dokumen', label: 'Dokumen Legal', icon: FileSignature },
    { href: '/kepala_bidang/laporan', label: 'Laporan', icon: BarChart3 },
    { href: '/kepala_bidang/settings', label: 'Settings', icon: Settings },
  ],
  case_manager: [
    { href: '/case_manager', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/case_manager/tugas', label: 'Tugas Saya', icon: Briefcase, children: [
      { href: '/case_manager/tugas', label: 'Individual' },
      { href: '/case_manager/adendum-masal', label: 'Adendum Masal' },
      { href: '/case_manager/dropping', label: 'Dropping Pusat' },
    ]},
    { href: '/case_manager/faskes', label: 'Faskes Mitra', icon: Building2 },
    { href: '/case_manager/dokumen-operasional', label: 'Dokumen Operasional', icon: FileText },
    { href: '/case_manager/tarif', label: 'Bank Tarif', icon: Wallet },
    { href: '/case_manager/settings', label: 'Settings', icon: Settings },
  ],
  penata_pelayanan: [
    { href: '/penata_pelayanan', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/penata_pelayanan/tugas', label: 'Tugas Saya', icon: Briefcase },
    { href: '/penata_pelayanan/faskes', label: 'Faskes Mitra', icon: Building2 },
    { href: '/penata_pelayanan/dokumen-operasional', label: 'Dokumen Operasional', icon: FileText },
  ],
  pic_rs: [
    { href: '/pic_rs', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/pic_rs/ajukan-baru', label: 'Buat Pengajuan', icon: Plus },
    { href: '/pic_rs/pengajuan', label: 'Pengajuan Saya', icon: Inbox },
    { href: '/pic_rs/dokumen', label: 'Dokumen Saya', icon: FileSignature },
    { href: '/pic_rs/tarif', label: 'Bank Tarif', icon: Wallet },
  ],
  legal_rs: [
    { href: '/legal_rs', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/legal_rs/review', label: 'Review', icon: FileSignature },
    { href: '/legal_rs/dokumen', label: 'Dokumen Legal', icon: FolderOpen },
    { href: '/legal_rs/audit', label: 'Audit Log', icon: ListChecks },
  ],
}

export function RoleShell({ user, kantor_nama, notifications = [], children }: RoleShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const theme = ROLE_THEMES[user.role]
  const nav = ROLE_NAV[user.role] || []
  const initials = user.full_name.split(' ').map(w => w.charAt(0)).slice(0,2).join('').toUpperCase()

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  // Save collapsed state
  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    if (next) setExpandedMenus(new Set()) // collapse all sub-menus when sidebar collapses
  }

  function toggleSubMenu(href: string) {
    setExpandedMenus(prev => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  // Auto-expand sub-menu if current path is a child
  useEffect(() => {
    nav.forEach(item => {
      if (item.children) {
        const isChildActive = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
        if (isChildActive) {
          setExpandedMenus(prev => new Set(prev).add(item.href))
        }
      }
    })
  }, [pathname])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const sidebarWidth = collapsed ? 'w-16' : 'w-60'

  const sidebar = (
    <div className={cn('flex flex-col h-full transition-all duration-300', sidebarWidth, theme.sidebar)}>
      {/* Toggle collapse button */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2 text-white min-w-0">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">Mitra PLKK</div>
              <div className="text-[9px] opacity-75 truncate">BPJS Ketenagakerjaan</div>
            </div>
          </div>
        )}
        {collapsed && <ShieldCheck className="w-5 h-5 text-white mx-auto" />}
        <button onClick={toggleCollapse} className="text-white/70 hover:text-white hidden lg:block flex-shrink-0">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User info — di atas (seperti desain referensi) */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className={cn(theme.accent, 'text-white text-xs font-semibold')}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user.full_name}</div>
              <div className="text-[10px] opacity-70 text-white truncate">{ROLE_LABELS[user.role]}</div>
              <div className="text-[9px] opacity-50 text-white truncate">{user.email}</div>
              <div className="text-[9px] opacity-50 text-white truncate">
                {kantor_nama || 'Semua Kantor Cabang'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== `/${user.role}` && pathname.startsWith(item.href))
          const Icon = item.icon
          const hasChildren = item.children && item.children.length > 0
          const isExpanded = expandedMenus.has(item.href)

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={() => { setMobileOpen(false); if (hasChildren && !collapsed) toggleSubMenu(item.href) }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm transition-colors mx-2 rounded-md mb-0.5',
                  active && !hasChildren
                    ? cn(theme.active, 'font-semibold')
                    : cn(theme.text, 'hover:bg-white/10'),
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                {!collapsed && hasChildren && (
                  <ChevronDown className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-180')} />
                )}
              </Link>
              {/* Sub-menu */}
              {hasChildren && isExpanded && !collapsed && (
                <div className="ml-6 mb-1">
                  {item.children!.map(child => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 text-xs transition-colors rounded-md',
                          childActive ? cn(theme.active, 'font-semibold') : cn(theme.text, 'hover:bg-white/10 opacity-80')
                        )}
                      >
                        <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer — logout + profile */}
      <div className="p-2 border-t border-white/10">
        <div className="flex items-center gap-1">
          <Link href="/profile" className={cn('flex items-center gap-2 px-2 py-1.5 rounded text-[10px] text-white/70 hover:text-white hover:bg-white/10 flex-1', collapsed && 'justify-center')}>
            <Settings className="w-3 h-3 flex-shrink-0" />
            {!collapsed && <span>Profil</span>}
          </Link>
          <button onClick={handleLogout} className={cn('text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded flex-shrink-0', collapsed && 'mx-auto')} title="Keluar">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  // Find current page label
  const currentLabel = nav.find(n => {
    if (pathname === n.href) return true
    if (n.href !== `/${user.role}` && pathname.startsWith(n.href)) return true
    if (n.children) return n.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
    return false
  })?.label || 'Mitra PLKK'

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block flex-shrink-0">{sidebar}</aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60">{sidebar}</SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header — putih, logo, info kantor, notif */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3 flex-shrink-0">
          {/* Mobile menu button */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
          </Sheet>

          {/* Logo + page title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-blue-700">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm lg:text-base font-semibold text-slate-900 truncate">{currentLabel}</h2>
              <p className="text-[10px] text-slate-500 truncate">
                {kantor_nama ? `📍 ${kantor_nama}` : user.role === 'pic_rs' || user.role === 'legal_rs' ? '📦 Faskes' : '🌐 Semua Kantor Cabang'}
              </p>
            </div>
          </div>

          {/* Notifications */}
          <div className="relative flex-shrink-0">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-slate-600" />
              {notifications.length > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] px-1.5 py-0 min-w-[16px] h-4 flex items-center justify-center">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </Badge>
              )}
            </Button>
          </div>

          {/* User badge di header */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <Avatar className="w-8 h-8">
              <AvatarFallback className={cn(theme.accent, 'text-white text-xs font-semibold')}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{user.full_name}</div>
              <div className="text-[10px] text-slate-500">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50">
          {children}
        </main>
      </div>

      <BotReceptionist user={user} />
    </div>
  )
}
