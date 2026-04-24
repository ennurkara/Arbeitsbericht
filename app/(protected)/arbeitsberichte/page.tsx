import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportList } from '@/components/arbeitsberichte/report-list'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { WorkReport, UserRole } from '@/lib/types'

export default async function ArbeitsberichtePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role as UserRole

  const { data: reports } = await supabase
    .from('work_reports')
    .select('*, customer:customers(name)')
    .order('created_at', { ascending: false })

  const canCreate = role === 'admin' || role === 'mitarbeiter'

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.022em] text-[var(--ink)] leading-tight">
            Arbeitsberichte
          </h1>
          <p className="text-sm text-[var(--ink-3)] mt-1">
            Alle deine Berichte auf einen Blick.
          </p>
        </div>
        {canCreate && (
          <Button asChild className="self-start sm:self-auto">
            <Link href="/arbeitsberichte/neu">
              <Plus className="h-4 w-4" />Neuer Bericht
            </Link>
          </Button>
        )}
      </div>
      <ReportList reports={(reports ?? []) as WorkReport[]} canCreate={canCreate} />
    </div>
  )
}
