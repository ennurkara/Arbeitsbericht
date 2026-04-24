import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { TopBar } from '@/components/layout/topbar'
import type { Profile } from '@/lib/types'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen bg-[var(--paper-2)] md:flex">
      <Sidebar profile={profile as Profile} />
      <div className="flex flex-col flex-1 min-w-0">
        <MobileNav profile={profile as Profile} />
        <TopBar />
        <main className="flex-1 overflow-x-hidden px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10 kb-scroll">
          {children}
        </main>
      </div>
    </div>
  )
}
