import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDateTime, deviceDisplayName } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { ReportStatusBadge } from '@/components/ui/status-badge'
import { PdfActions } from '@/components/arbeitsberichte/pdf-actions'
import { PdfRecovery } from '@/components/arbeitsberichte/pdf-recovery'
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
    role === 'admin' || role === 'mitarbeiter' || role === 'viewer'
    || report.technician_id === user.id
  if (!canView) redirect('/arbeitsberichte')

  // Entwürfe (eigene oder als Admin) öffnen direkt im Bearbeiten-Wizard.
  // Mitarbeiter + Viewer sehen den Entwurf als read-only Detail-View — sie
  // dürfen fremde Drafts nicht ändern (ihr Workflow ist Übersicht, nicht
  // Eingriff in einen laufenden Techniker-Bericht).
  if (
    report.status === 'entwurf' &&
    (role === 'admin' || report.technician_id === user.id)
  ) {
    redirect(`/arbeitsberichte/${id}/bearbeiten`)
  }

  const devices = (report.devices ?? []).map((d: any) => d.device)

  // Lifecycle-Assignments für diesen AB → Aktion + Tausch-Pair pro Gerät.
  const { data: assignmentRows } = await supabase
    .from('device_assignments')
    .select(`
      id, device_id, kind, swap_pair_id,
      device:devices(id, serial_number, model:models(modellname, variante, manufacturer:manufacturers(name)))
    `)
    .eq('work_report_id', id)
  const assignmentById = new Map<string, any>()
  const assignmentByDevice = new Map<string, any>()
  for (const a of (assignmentRows ?? []) as any[]) {
    assignmentById.set(a.id, a)
    if (a.kind !== 'austausch_rein') assignmentByDevice.set(a.device_id, a)
  }
  const KIND_LABEL_DE: Record<string, string> = {
    leihe: 'Leihe',
    verkauf: 'Verkauf',
    austausch_raus: 'Austausch',
  }
  function pairFor(deviceId: string): { name: string; serial: string | null } | null {
    const a = assignmentByDevice.get(deviceId)
    if (!a || a.kind !== 'austausch_raus' || !a.swap_pair_id) return null
    const p = assignmentById.get(a.swap_pair_id)
    if (!p?.device) return null
    return { name: deviceDisplayName(p.device.model), serial: p.device.serial_number ?? null }
  }

  let pdfUrl: string | null = null
  if (report.pdf_path) {
    const { data: signed } = await supabase.storage
      .from('work-report-pdfs')
      .createSignedUrl(report.pdf_path, 60 * 10)
    pdfUrl = signed?.signedUrl ?? null
  }

  // Re-Generation ist sinnvoll, sobald der Bericht abgeschlossen ist und
  // mindestens die Techniker-Unterschrift vorliegt. Die Kunden-Unterschrift
  // ist bei DHL-Versand absichtlich leer — vorher hat dieser Gate alle
  // DHL-Reports vom Nachziehen ausgeschlossen.
  const canRegenerate =
    report.status === 'abgeschlossen' && !!report.technician_signature

  // Auto-Recovery: Bericht ist abgeschlossen, hat Signatur, aber kein
  // pdf_path → triggere die Erstellung beim Page-Load. Deckt alle Fälle ab,
  // in denen der Wizard-Finish die Persistierung nicht durchgezogen hat.
  const needsPdfRecovery =
    report.status === 'abgeschlossen' &&
    !!report.technician_signature &&
    !report.pdf_path

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

      {needsPdfRecovery && <PdfRecovery reportId={report.id} />}

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
            <div className="space-y-2.5">
              {devices.map((d: any) => {
                const a = assignmentByDevice.get(d.id)
                const kindText = a?.kind ? KIND_LABEL_DE[a.kind] ?? a.kind : null
                const pair = pairFor(d.id)
                return (
                  <div key={d.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-[13px] flex-wrap">
                      <span className="text-[var(--ink-2)] font-medium">{deviceDisplayName(d.model)}</span>
                      <div className="flex items-center gap-2">
                        {kindText && (
                          <span className={
                            a?.kind === 'verkauf'
                              ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium bg-[var(--paper-3)] text-[var(--ink-3)]'
                              : a?.kind === 'austausch_raus'
                                ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium bg-[var(--amber-tint)] text-[var(--amber)]'
                                : 'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium bg-[var(--blue-tint)] text-[var(--blue-ink)]'
                          }>
                            {kindText}
                          </span>
                        )}
                        {d.serial_number && (
                          <span className="text-[var(--ink-4)] font-mono text-[11.5px]">SN {d.serial_number}</span>
                        )}
                      </div>
                    </div>
                    {pair && (
                      <div className="text-[12px] text-[var(--ink-3)] pl-3 border-l-2 border-[var(--amber)] flex items-center gap-2">
                        <span>↳ Rückläufer zur Reparatur:</span>
                        <span className="text-[var(--ink-2)]">{pair.name}</span>
                        {pair.serial && (
                          <span className="text-[var(--ink-4)] font-mono">SN {pair.serial}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
