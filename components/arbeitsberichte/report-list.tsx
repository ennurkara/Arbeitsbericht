'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ReportStatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/utils'
import { FileText, Plus, ChevronRight, Clock } from 'lucide-react'
import type { WorkReport, WorkReportStatus } from '@/lib/types'

interface ReportListProps {
  reports: WorkReport[]
  canCreate: boolean
  /** Wenn true, linken Entwürfe auf den /bearbeiten-Wizard statt auf die Detail-View. */
  canEditDrafts: boolean
}

const DRAFT_TTL_MS = 15 * 60 * 1000

/** Verbleibende Minuten bis zum Auto-Delete eines Entwurfs. < 0 wenn abgelaufen. */
function draftMinutesLeft(createdAt: string): number {
  const expires = new Date(createdAt).getTime() + DRAFT_TTL_MS
  return Math.max(0, Math.round((expires - Date.now()) / 60000))
}

export function ReportList({ reports, canCreate, canEditDrafts }: ReportListProps) {
  // Tickt jede 30s, damit der "läuft ab in X min"-Hint stimmig bleibt.
  const [, force] = useState(0)
  useEffect(() => {
    if (!reports.some(r => r.status === 'entwurf')) return
    const id = setInterval(() => force(n => n + 1), 30_000)
    return () => clearInterval(id)
  }, [reports])

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
      {reports.map((report, i) => {
        const isDraft = report.status === 'entwurf'
        const href = isDraft && canEditDrafts
          ? `/arbeitsberichte/${report.id}/bearbeiten`
          : `/arbeitsberichte/${report.id}`
        const minutesLeft = isDraft ? draftMinutesLeft(report.created_at) : null

        return (
          <Link
            key={report.id}
            href={href}
            className={`flex items-center justify-between px-4 py-3 hover:bg-[var(--paper-2)] transition-colors ${
              i > 0 ? 'border-t border-[var(--rule-soft)]' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[13.5px] font-medium text-[var(--ink)] truncate">
                  {report.report_number ?? 'Entwurf'}
                </span>
                <ReportStatusBadge status={report.status as WorkReportStatus} />
                {isDraft && minutesLeft !== null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--amber)]">
                    <Clock className="h-3 w-3" />
                    {minutesLeft > 0 ? `läuft ab in ${minutesLeft} min` : 'läuft ab'}
                  </span>
                )}
              </div>
              <p className="text-[12.5px] text-[var(--ink-3)] truncate">
                {report.customer?.name ?? '—'} · {formatDate(report.created_at)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--ink-4)] shrink-0 ml-3" />
          </Link>
        )
      })}
    </div>
  )
}
