'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReportStatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/utils'
import { FileText, Plus, ChevronRight } from 'lucide-react'
import type { WorkReport, WorkReportStatus } from '@/lib/types'

interface ReportListProps {
  reports: WorkReport[]
  canCreate: boolean
}

export function ReportList({ reports, canCreate }: ReportListProps) {
  if (reports.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-[var(--rule)] rounded-kb">
        <FileText className="h-12 w-12 text-[var(--ink-4)] mx-auto mb-4" />
        <p className="text-[var(--ink-3)] mb-4">Noch keine Arbeitsberichte vorhanden.</p>
        {canCreate && (
          <Button asChild>
            <Link href="/arbeitsberichte/neu">
              <Plus className="h-4 w-4" />Neuer Bericht
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-[var(--rule)] rounded-kb overflow-hidden">
      {reports.map((report, i) => (
        <Link
          key={report.id}
          href={`/arbeitsberichte/${report.id}`}
          className={`flex items-center justify-between px-4 py-3 hover:bg-[var(--paper-2)] transition-colors ${
            i > 0 ? 'border-t border-[var(--rule-soft)]' : ''
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13.5px] font-medium text-[var(--ink)] truncate">
                {report.report_number ?? 'Entwurf'}
              </span>
              <ReportStatusBadge status={report.status as WorkReportStatus} />
            </div>
            <p className="text-[12.5px] text-[var(--ink-3)] truncate">
              {report.customer?.name ?? '—'} · {formatDate(report.created_at)}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--ink-4)] shrink-0 ml-3" />
        </Link>
      ))}
    </div>
  )
}
