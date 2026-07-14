'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, FileSignature, Building2, Users, Settings, 
  LogOut, Menu, X, Bell, MessageCircle, Calendar, BarChart3, 
  FileText, ListChecks, Wallet, ChevronRight, ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/auth-constants'
import { BotReceptionist } from '@/components/bot/BotReceptionist'

export interface RoleShellProps {
  user: {
    id: string
    email: string
    full_name: string
    role: 'admin_kantor' | 'case_manager' | 'kepala_bidang' | 'pic_rs' | 'legal_rs'
    kantor_cabang_id: string | null
    faskes_id: string | null
  }
  kantor_nama?: string
  notifications?: { id: string; title: string; body: string; created_at: string }[]
  children: React.ReactNode
}

const ROLE_THEMES = {
  super_admin:      { sidebar: 'bg-rose-900',  accent: 'bg-rose-700',  text: 'text-rose-100',  active: 'bg-rose-700 text-white' },
  admin_kantor:    { sidebar: 'bg-slate-800', accent: 'bg-slate-700', text: 'text-slate-300', active: 'bg-slate-700 text-white' },
  case_manager:    { sidebar: 'bg-blue-900',  accent: 'bg-blue-700',  text: 'text-blue-100', active: 'bg-blue-700 text-white' },
  kepala_bidang:   { sidebar: 'bg-teal-900',  accent: 'bg-teal-700',  text: 'text-teal-100', active: 'bg-teal-700 text-white' },
  pic_rs:          { sidebar: 'bg-orange-800',accent: 'bg-orange-600',text: 'text-orange-100',active: 'bg-orange-600 text-white' },
  legal_rs:        { sidebar: 'bg-purple-900',accent: 'bg-purple-700',text: 'text-purple-100',active: 'bg-purple-700 text-white' },
} as const

const ROLE_NAV: Record<string, { href: string; label: string; icon: any }[]> = {
  super_admin: [
    { href: '/super_admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/super_admin/kantor', label: 'Kantor Cabang', icon: Building2 },
    { href: '/super_admin/users', label: 'Semua User', icon: Users },
    { href: '/super_admin/audit', label: 'Audit Log', icon: ListChecks },
    { href: '/super_admin/settings', label: 'Pengaturan', icon: Settings },
  ],
  admin_kantor: [
    { href: '/admin_kantor', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin_kantor/kantor', label: 'Kantor Cabang Saya', icon: Building2 },
    { href: '/admin_kantor/users', label: 'Manajemen User', icon: Users },
    { href: '/admin_kantor/templates', label: 'Template PKS', icon: FileText },
    { href: '/admin_kantor/tarif', label: 'Bank Tarif', icon: Wallet },
    { href: '/admin_kantor/audit', label: 'Audit Log', icon: ListChecks },
    { href: '/admin_kantor/settings', label: 'Pengaturan', icon: Settings },
  ],
  case_manager: [
    { href: '/case_manager', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/case_manager/onboarding', label: 'Onboarding Faskes', icon: Building2 },
    { href: '/case_manager/pks', label: 'Daftar PKS', icon: FileSignature },
    { href: '/case_manager/pks/new', label: 'Buat PKS Baru', icon: FileText },
    { href: '/case_manager/adendum', label: 'Adendum', icon: ListChecks },
    { href: '/case_manager/dropping', label: 'Dropping Pusat', icon: ShieldCheck },
    { href: '/case_manager/perpanjangan', label: 'Perpanjangan', icon: Calendar },
    { href: '/case_manager/tarif', label: 'Komparasi Tarif', icon: BarChart3 },
  ],
  kepala_bidang: [
    { href: '/kepala_bidang', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/kepala_bidang/onboarding', label: 'Pipeline Onboarding', icon: Building2 },
    { href: '/kepala_bidang/pks', label: 'Daftar PKS', icon: FileSignature },
    { href: '/kepala_bidang/dropping', label: 'Dropping Pusat', icon: ShieldCheck },
    { href: '/kepala_bidang/approval', label: 'Approval Queue', icon: ListChecks },
    { href: '/kepala_bidang/tarif', label: 'Analisis Tarif', icon: BarChart3 },
    { href: '/kepala_bidang/reminder', label: 'Reminder PKS', icon: Calendar },
  ],
  pic_rs: [
    { href: '/pic_rs', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/pic_rs/pks', label: 'PKS Saya', icon: FileSignature },
    { href: '/pic_rs/tarif', label: 'Upload Tarif', icon: Wallet },
    { href: '/pic_rs/dropping', label: 'Dropping Pusat', icon: ShieldCheck },
    { href: '/pic_rs/perpanjangan', label: 'Ajukan Perpanjangan', icon: Calendar },
    { href: '/pic_rs/adendum', label: 'Ajukan Adendum Harga', icon: FileText },
    { href: '/pic_rs/dokumen', label: 'Dokumen Kredensial', icon: FileText },
  ],
  legal_rs: [
    { href: '/legal_rs', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/legal_rs/review', label: 'PKS Mfg Review', icon: FileSignature },
    { href: '/legal_rs/dropping', label: 'Dropping Pusat', icon: ShieldCheck },
    { href: '/legal_rs/signed', label: 'Sudah Ditandatangani', icon: ListChecks },
  ],
}

export function RoleShell({ user, kantor_nama, notifications = [], children }: RoleShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const theme = ROLE_THEMES[user.role]
  const nav = ROLE_NAV[user.role] || []
  const initials = user.full_name.split(' ').map(w => w.charAt(0)).slice(0,2).join('').toUpperCase()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const sidebar = (
    <div className={cn('flex flex-col h-full w-64', theme.sidebar)}>
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-6 h-6" />
          <div>
            <div className="font-bold text-sm">WPA</div>
            <div className="text-[10px] opacity-75">PKS BPJS Ketenagakerjaan</div>
          </div>
        </div>
      </div>
      <div className="p-3 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-wider opacity-60 text-white">Kantor Cabang</div>
        <div className="text-xs font-semibold text-white truncate">
          {kantor_nama || 'Default'}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== `/${user.role}` && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-2 rounded-md',
                active 
                  ? cn(theme.active, 'font-semibold') 
                  : cn(theme.text, 'hover:bg-white/10')
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="w-8 h-8">
            <AvatarFallback className={cn(theme.accent, 'text-white text-xs font-semibold')}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{user.full_name}</div>
            <div className="text-[10px] opacity-70 text-white truncate">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block flex-shrink-0">{sidebar}</aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <div className="flex-1">
            <h2 className="text-base lg:text-lg font-semibold text-slate-900">
              {nav.find(n => pathname === n.href || (n.href !== `/${user.role}` && pathname.startsWith(n.href)))?.label || 'WPA'}
            </h2>
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-slate-600" />
              {notifications.length > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] px-1.5 py-0 min-w-[16px] h-4 flex items-center justify-center">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </Badge>
              )}
            </Button>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-slate-700">{user.full_name}</div>
            <div className="text-[10px] text-slate-500">{ROLE_LABELS[user.role]}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Bot Resepsionis — widget pojok kanan */}
      <BotReceptionist user={user} />
      
      {/* Profile link button (top-right floating) */}
      <Link href="/profile" className="hidden lg:flex fixed bottom-4 left-4 z-40 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-all p-2 items-center gap-2 text-xs">
        <Avatar className="w-6 h-6">
          <AvatarFallback className={cn(theme.accent, 'text-white text-[10px] font-semibold')}>
            {user.full_name.split(' ').map(w => w.charAt(0)).slice(0,2).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium pr-2">Profil Saya</span>
      </Link>
    </div>
  )
}
