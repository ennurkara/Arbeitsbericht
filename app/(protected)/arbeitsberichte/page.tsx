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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Arbeitsberichte</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/arbeitsberichte/neu">
              <Plus className="h-4 w-4 mr-2" />Neuer Bericht
            </Link>
          </Button>
        )}
      </div>
      <ReportList reports={(reports ?? []) as WorkReport[]} canCreate={canCreate} />
    </div>
  )
}