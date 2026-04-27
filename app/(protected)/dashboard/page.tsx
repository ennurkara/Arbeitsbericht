import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Plus, FileText, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ReportStatusBadge } from '@/components/ui/status-badge'
import type { UserRole, WorkReportStatus } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const role = profile?.role as UserRole
  const canCreate = role === 'admin' || role === 'mitarbeiter' || role === 'techniker'

  // Techniker sehen nur eigene Berichte; admin / mitarbeiter / viewer sehen
  // den globalen Stand. Spiegelt die RLS-Policies aus Migration 042.
  const isTechnician = role === 'techniker'
  const recentQuery = supabase
    .from('work_reports')
    .select('*, customer:customers(name)')
    .order('created_at', { ascending: false })
    .limit(5)
  const draftQuery = supabase
    .from('work_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'entwurf')
  if (isTechnician) {
    recentQuery.eq('technician_id', user.id)
    draftQuery.eq('technician_id', user.id)
  }
  const [{ data: recentReports }, { count: draftCount }] = await Promise.all([
    recentQuery,
    draftQuery,
  ])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.022em] text-[var(--ink)] leading-tight break-words">
          Willkommen, {profile?.full_name}
        </h1>
        <p className="text-sm text-[var(--ink-3)] mt-1">Digitale Arbeitsberichte</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[var(--ink-3)] mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-[12.5px] font-medium">Entwürfe</span>
            </div>
            <p className="text-[32px] font-semibold tracking-[-0.022em] text-[var(--ink)] tabular-nums">
              {draftCount ?? 0}
            </p>
          </CardContent>
        </Card>
        {canCreate && (
          <Card className="flex items-center justify-center">
            <CardContent className="p-4 w-full">
              <Button asChild className="w-full">
                <Link href="/arbeitsberichte/neu">
                  <Plus className="h-4 w-4" />Neuer Bericht
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {recentReports && recentReports.length > 0 && (
        <div>
          <div className="kb-label mb-2">Letzte Berichte</div>
          <div className="bg-white border border-[var(--rule)] rounded-kb overflow-hidden">
            {recentReports.map((r, i) => (
              <Link
                key={r.id}
                href={`/arbeitsberichte/${r.id}`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-[var(--paper-2)] transition-colors ${
                  i > 0 ? 'border-t border-[var(--rule-soft)]' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-[var(--ink-4)] shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-[var(--ink)] truncate">
                        {r.report_number ?? 'Entwurf'}
                      </span>
                      <ReportStatusBadge status={r.status as WorkReportStatus} />
                    </div>
                    <p className="text-[12px] text-[var(--ink-3)] truncate">
                      {(r as any).customer?.name ?? '—'} · {formatDate(r.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
