'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import type { Profile } from '@/lib/types'
import {
  LayoutDashboard,
  ClipboardList,
  Plus,
  LogOut,
} from 'lucide-react'

const mainLinks = [
  { href: '/dashboard',           label: 'Dashboard',       icon: LayoutDashboard, kb: '1' },
  { href: '/arbeitsberichte',     label: 'Arbeitsberichte', icon: ClipboardList,   kb: '2' },
]

const createLink = { href: '/arbeitsberichte/neu', label: 'Neuer Bericht', icon: Plus, kb: 'N' }

function initials(name: string | null | undefined) {
  if (!name) return '··'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('')
}

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const canCreate = profile.role === 'admin' || profile.role === 'mitarbeiter' || profile.role === 'techniker'

  return (
    <aside className="hidden md:flex w-[232px] flex-col flex-shrink-0 bg-white border-r border-[var(--rule)] h-screen sticky top-0">
      <div className="px-5 pt-5 pb-4">
        <Logo height={22} />
        <div className="mt-2 text-[11px] font-medium text-[var(--ink-3)] tracking-[-0.003em]">
          Kassen Buch · v1.0
        </div>
      </div>

      <div className="px-1 pt-2">
        <div className="kb-label px-3 mb-1">Betrieb</div>
        {mainLinks.map(({ href, label, icon: Icon, kb }) => {
          const active = href === '/arbeitsberichte'
            ? pathname === '/arbeitsberichte' || (pathname.startsWith('/arbeitsberichte/') && !pathname.startsWith('/arbeitsberichte/neu'))
            : pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={cn('kb-side-item', active && 'active')}>
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
              <span>{label}</span>
              <span className="kbn">⌘{kb}</span>
            </Link>
          )
        })}
      </div>

      {canCreate && (
        <div className="px-1 pt-3">
          <div className="kb-label px-3 mb-1">Aktion</div>
          <Link
            href={createLink.href}
            className={cn('kb-side-item', pathname.startsWith(createLink.href) && 'active')}
          >
            <createLink.icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
            <span>{createLink.label}</span>
            <span className="kbn">⌘{createLink.kb}</span>
          </Link>
        </div>
      )}

      <div className="mt-auto border-t border-[var(--rule)] px-4 py-3 flex items-center gap-2.5">
        <div className="kb-av">{initials(profile.full_name)}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">
            {profile.full_name ?? 'Benutzer'}
          </div>
          <div className="text-[11px] text-[var(--ink-3)] capitalize">
            {profile.role}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          aria-label="Abmelden"
          className="rounded-md p-1.5 text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
