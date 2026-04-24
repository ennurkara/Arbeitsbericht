'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ClipboardList, Plus } from 'lucide-react'
import { Logo } from './logo'
import type { Profile } from '@/lib/types'

const tabs = [
  { href: '/dashboard',       label: 'Dashboard', icon: LayoutDashboard },
  { href: '/arbeitsberichte', label: 'Berichte',  icon: ClipboardList },
]

export function MobileNav({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const canCreate = profile.role === 'admin' || profile.role === 'mitarbeiter'

  const isBerichteActive = (href: string) => {
    if (href !== '/arbeitsberichte') return pathname.startsWith(href)
    return pathname === '/arbeitsberichte' || (pathname.startsWith('/arbeitsberichte/') && !pathname.startsWith('/arbeitsberichte/neu'))
  }

  return (
    <>
      <nav className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-white/80 backdrop-blur-md border-b border-[var(--rule)]">
        <Logo height={20} />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>Abmelden</Button>
      </nav>

      <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-[var(--rule)]">
        <div className={cn('grid h-16', canCreate ? 'grid-cols-3' : 'grid-cols-2')}>
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isBerichteActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-[var(--blue)]' : 'text-[var(--ink-4)]'
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            )
          })}
          {canCreate && (
            <Link
              href="/arbeitsberichte/neu"
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                pathname.startsWith('/arbeitsberichte/neu') ? 'text-[var(--blue)]' : 'text-[var(--ink-4)]'
              )}
            >
              <Plus className="h-5 w-5" />
              Neu
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
