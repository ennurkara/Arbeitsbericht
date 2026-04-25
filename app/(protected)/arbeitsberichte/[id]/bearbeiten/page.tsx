import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wizard } from '@/components/arbeitsberichte/wizard'
import { isoToLocalISO16 } from '@/lib/utils'
import type { Profile, UserRole } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function EntwurfBearbeitenPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const role = profile?.role as UserRole
  if (role === 'viewer') redirect(`/arbeitsberichte/${id}`)

  // Stale Drafts opportunistisch wegputzen (15-Min-Inaktivitäts-Regel).
  await supabase.rpc('cleanup_old_work_report_drafts')

  // Touch der eigenen Row direkt beim Öffnen, damit das Bearbeiten-Aufrufen
  // den Inaktivitäts-Timer sofort zurücksetzt. (Kommt vor dem SELECT.)
  await supabase
    .from('work_reports')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'entwurf')

  const { data: report } = await supabase
    .from('work_reports')
    .select(`
      id, status, technician_id, customer_id,
      description, work_hours,
      travel_from, travel_to, travel_distance_km,
      start_time, end_time,
      technician_signature, customer_signature,
      devices:work_report_devices(device_id)
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  // Nur eigene Entwürfe (oder als Admin) bearbeitbar. Abgeschlossene Berichte
  // gehen direkt zur Detail-View.
  if (report.status !== 'entwurf') redirect(`/arbeitsberichte/${id}`)
  if (role !== 'admin' && report.technician_id !== user.id) {
    redirect(`/arbeitsberichte/${id}`)
  }

  const deviceIds = ((report.devices ?? []) as Array<{ device_id: string }>)
    .map(d => d.device_id)

  const initialDraft = {
    reportId: report.id,
    customerId: report.customer_id ?? '',
    description: report.description ?? '',
    deviceIds,
    workHours: report.work_hours != null ? String(report.work_hours) : '',
    travelFrom: report.travel_from ?? 'Parsbergstraße 16, 82239 Alling',
    travelTo: report.travel_to ?? '',
    travelDistanceKm: (report as { travel_distance_km: number | null }).travel_distance_km ?? null,
    startTime: isoToLocalISO16(report.start_time),
    endTime: isoToLocalISO16(report.end_time),
    technicianSignature: report.technician_signature,
    customerSignature: report.customer_signature,
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.022em] text-[var(--ink)] leading-tight mb-2">
        Entwurf fortsetzen
      </h1>
      <p className="text-[13px] text-[var(--ink-3)] mb-6">
        Entwürfe werden automatisch nach 15 Minuten gelöscht. Schließe den Bericht zeitnah ab.
      </p>
      <Wizard profile={profile as Profile} initialDraft={initialDraft} />
    </div>
  )
}
