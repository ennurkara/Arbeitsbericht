'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { FileText, Plus } from 'lucide-react'
import type { WorkReport } from '@/lib/types'

interface ReportListProps {
  reports: WorkReport[]
  canCreate: boolean
}

export function ReportList({ reports, canCreate }: ReportListProps) {
  if (reports.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 mb-4">Noch keine Arbeitsberichte vorhanden.</p>
        {canCreate && (
          <Button asChild>
            <Link href="/arbeitsberichte/neu">
              <Plus className="h-4 w-4 mr-2" />Neuer Bericht
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reports.map(report => (
        <Link key={report.id} href={`/arbeitsberichte/${report.id}`}
          className="block bg-white rounded-lg border p-4 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-900">
                  {report.report_number ?? 'Entwurf'}
                </span>
                <Badge variant={report.status === 'abgeschlossen' ? 'default' : 'secondary'}>
                  {report.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Entwurf'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {report.customer?.name ?? '—'} · {formatDate(report.created_at)}
              </p>
            </div>
            <FileText className="h-5 w-5 text-slate-300" />
          </div>
        </Link>
      ))}
    </div>
  )
}