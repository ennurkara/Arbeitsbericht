import { Badge } from './badge'
import type { WorkReportStatus } from '@/lib/types'

const MAP: Record<WorkReportStatus, { label: string; variant: 'reserv' | 'lager' }> = {
  entwurf:       { label: 'Entwurf',       variant: 'reserv' },
  abgeschlossen: { label: 'Abgeschlossen', variant: 'lager'  },
}

export function ReportStatusBadge({ status }: { status: WorkReportStatus | string }) {
  const def = MAP[status as WorkReportStatus] ?? MAP.entwurf
  return (
    <Badge variant={def.variant} withDot>
      {def.label}
    </Badge>
  )
}
