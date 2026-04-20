import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FileText, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const role = profile?.role as UserRole
  const canCreate = role === 'admin' || role === 'mitarbeiter'

  const [{ data: recentReports }, { count: draftCount }] = await Promise.all([
    supabase
      .from('work_reports')
      .select('*, customer:customers(name)')
      .eq('technician_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('work_reports')
      .select('*', { count: 'exact', head: true })
      .eq('technician_id', user.id)
      .eq('status', 'entwurf'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Willkommen, {profile?.full_name}</h1>
        <p className="text-slate-500 mt-1">Digitale Arbeitsberichte</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Entwürfe</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{draftCount ?? 0}</p>
        </div>
        {canCreate && (
          <div className="bg-white rounded-lg border p-4 flex items-center justify-center">
            <Button asChild className="w-full">
              <Link href="/arbeitsberichte/neu">
                <Plus className="h-4 w-4 mr-2" />Neuer Bericht
              </Link>
            </Button>
          </div>
        )}
      </div>

      {recentReports && recentReports.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Letzte Berichte</h2>
          <div className="space-y-2">
            {recentReports.map(r => (
              <Link key={r.id} href={`/arbeitsberichte/${r.id}`}
                className="flex items-center justify-between bg-white rounded-lg border p-3 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{r.report_number ?? 'Entwurf'}</p>
                    <p className="text-xs text-slate-500">
                      {(r as any).customer?.name} · {formatDate(r.created_at)}
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