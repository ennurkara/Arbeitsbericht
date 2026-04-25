import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDateTime, deviceDisplayName } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { ReportStatusBadge } from '@/components/ui/status-badge'
import { PdfActions } from '@/components/arbeitsberichte/pdf-actions'
import type { UserRole, WorkReportStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BerichtDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role as UserRole

  const { data: report } = await supabase
    .from('work_reports')
    .select(`
      *,
      customer:customers(*),
      technician:profiles!work_reports_technician_id_fkey(full_name),
      devices:work_report_devices(device:devices(
        id,
        serial_number,
        model:models(
          modellname,
          variante,
          manufacturer:manufacturers(name)
        )
      ))
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  const canView =
    role === 'admin' || role === 'viewer' || report.technician_id === user.id
  if (!canView) redirect('/arbeitsberichte')

  const devices = (report.devices ?? []).map((d: any) => d.device)

  let pdfUrl: string | null = null
  if (report.pdf_path) {
    const { data: signed } = await supabase.storage
      .from('work-report-pdfs')
      .createSignedUrl(report.pdf_path, 60 * 10)
    pdfUrl = signed?.signedUrl ?? null
  }

  // Re-Generation ist nur sinnvoll wenn Bericht abgeschlossen ist und beide
  // Unterschriften vorliegen. Andernfalls rendert die Vorlage leere Signatur-Boxen.
  const canRegenerate =
    report.status === 'abgeschlossen' &&
    !!report.technician_signature &&
    !!report.customer_signature

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 sm:gap-3 mb-6 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/arbeitsberichte" aria-label="Zurück"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-lg sm:text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {report.report_number ?? 'Entwurf'}
        </h1>
        <ReportStatusBadge status={report.status as WorkReportStatus} />
        {canRegenerate && (
          <div className="ml-auto">
            <PdfActions
              reportId={report.id}
              reportNumber={report.report_number ?? null}
              pdfUrl={pdfUrl}
            />
          </div>
        )}
      </div>

      {report.status === 'entwurf' && (
        <div className="bg-[var(--amber-tint)] border border-[var(--rule)] rounded-kb p-4 mb-6 flex items-center justify-between">
          <p className="text-[13px] text-[var(--amber)]">Dieser Bericht ist noch nicht abgeschlossen.</p>
          <Button size="sm" asChild>
            <Link href="/arbeitsberichte/neu">Neuer Bericht</Link>
          </Button>
        </div>
      )}

      <div className="bg-white rounded-kb border border-[var(--rule)] divide-y divide-[var(--rule-soft)]">
        <div className="p-5">
          <div className="kb-label mb-1">Kunde</div>
          <p className="font-medium text-[var(--ink)]">{(report.customer as any)?.name ?? '—'}</p>
          {(report.customer as any)?.address && (
            <p className="text-[13px] text-[var(--ink-3)]">{(report.customer as any).address}</p>
          )}
          {((report.customer as any)?.postal_code || (report.customer as any)?.city) && (
            <p className="text-[13px] text-[var(--ink-3)]">
              {[(report.customer as any).postal_code, (report.customer as any).city].filter(Boolean).join(' ')}
            </p>
          )}
          {(report.customer as any)?.phone && (
            <p className="text-[13px] text-[var(--ink-3)]">{(report.customer as any).phone}</p>
          )}
          {(report.customer as any)?.email && (
            <p className="text-[13px] text-[var(--ink-3)]">{(report.customer as any).email}</p>
          )}
        </div>

        <div className="p-5">
          <div className="kb-label mb-1">Techniker &amp; Aufwand</div>
          <p className="font-medium text-[var(--ink)]">{(report.technician as any)?.full_name ?? '—'}</p>
          {report.start_time && (
            <p className="text-[13px] text-[var(--ink-3)]">{formatDateTime(report.start_time)}</p>
          )}
          {report.work_hours != null && (
            <p className="text-[13px] text-[var(--ink-3)]">{report.work_hours}h Aufwand</p>
          )}
          {report.travel_from && report.travel_to && (
            <p className="text-[13px] text-[var(--ink-3)]">
              Anfahrt: {report.travel_from} → {report.travel_to}
            </p>
          )}
        </div>

        {report.description && (
          <div className="p-5">
            <div className="kb-label mb-2">Ausgeführte Tätigkeit</div>
            <p className="text-[13px] text-[var(--ink-2)] whitespace-pre-wrap">{report.description}</p>
          </div>
        )}

        {devices.length > 0 && (
          <div className="p-5">
            <div className="kb-label mb-3">Installierte Geräte</div>
            <div className="space-y-2">
              {devices.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--ink-2)] font-medium">{deviceDisplayName(d.model)}</span>
                  {d.serial_number && (
                    <span className="text-[var(--ink-4)] font-mono text-[11.5px]">{d.serial_number}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.status === 'abgeschlossen' && (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.technician_signature && (
              <div>
                <div className="kb-label mb-2">Unterschrift Techniker</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.technician_signature}
                  alt="Unterschrift Techniker"
                  className="border border-[var(--rule)] rounded-md h-20 w-full object-contain bg-white"
                />
              </div>
            )}
            {report.customer_signature && (
              <div>
                <div className="kb-label mb-2">Unterschrift Kunde</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.customer_signature}
                  alt="Unterschrift Kunde"
                  className="border border-[var(--rule)] rounded-md h-20 w-full object-contain bg-white"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
