import { createClient } from '@/lib/supabase/server'
import { renderReportPdf, type ReportPdfInput } from '@/lib/pdf-render'
import { deviceDisplayName } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: { reportId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }
  const reportId = body.reportId
  if (!reportId) {
    return Response.json({ error: 'reportId fehlt' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { data: report, error: reportErr } = await supabase
    .from('work_reports')
    .select(`
      id, report_number, description, work_hours,
      travel_from, travel_to, travel_distance_km,
      start_time, end_time,
      technician_signature, customer_signature, status,
      customer:customers(name, address, postal_code, city, phone, email),
      technician:profiles!work_reports_technician_id_fkey(full_name),
      devices:work_report_devices(device:devices(
        id, serial_number,
        model:models(modellname, variante, manufacturer:manufacturers(name))
      ))
    `)
    .eq('id', reportId)
    .single()

  if (reportErr || !report) {
    return Response.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }
  if (report.status !== 'abgeschlossen') {
    return Response.json({ error: 'Bericht ist noch nicht abgeschlossen' }, { status: 400 })
  }

  const customer = (report as any).customer ?? {}
  const technician = (report as any).technician ?? {}

  // Lifecycle-Assignments dieses AB laden — pro Gerät die Aktion (Leihe /
  // Verkauf / Austausch). Bei austausch_raus über swap_pair_id den
  // Rückläufer-Partner (austausch_rein) finden, dessen Geräte-Info wir
  // in der Material-Tabelle als zweite Zeile rendern.
  const { data: assignmentRows } = await supabase
    .from('device_assignments')
    .select(`
      id, device_id, kind, swap_pair_id,
      device:devices(id, serial_number, model:models(modellname, variante, manufacturer:manufacturers(name)))
    `)
    .eq('work_report_id', reportId)
  const assignmentById = new Map<string, any>()
  const assignmentByDeviceId = new Map<string, any>()
  for (const a of (assignmentRows ?? []) as any[]) {
    assignmentById.set(a.id, a)
    // Nur die "aktive" Seite indexieren — austausch_rein ist der Rückläufer,
    // den wir nicht als Hauptzeile, sondern als Pair des raus rendern.
    if (a.kind !== 'austausch_rein') assignmentByDeviceId.set(a.device_id, a)
  }

  const devices = ((report as any).devices ?? []).map((d: any) => {
    const deviceId = d.device?.id
    const assignment = deviceId ? assignmentByDeviceId.get(deviceId) : null
    let pair_name: string | null = null
    let pair_serial: string | null = null
    if (assignment?.kind === 'austausch_raus' && assignment.swap_pair_id) {
      const pair = assignmentById.get(assignment.swap_pair_id)
      if (pair?.device) {
        pair_name = deviceDisplayName(pair.device.model)
        pair_serial = pair.device.serial_number ?? null
      }
    }
    return {
      name: deviceDisplayName(d.device?.model),
      serial_number: d.device?.serial_number ?? null,
      kind: (assignment?.kind ?? null) as 'leihe' | 'verkauf' | 'austausch_raus' | null,
      pair_name,
      pair_serial,
    }
  })

  const input: ReportPdfInput = {
    reportNumber: report.report_number ?? null,
    customer: {
      name: customer.name ?? null,
      address: customer.address ?? null,
      postal_code: customer.postal_code ?? null,
      city: customer.city ?? null,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
    },
    technician: { full_name: technician.full_name ?? null },
    report: {
      description: report.description ?? null,
      work_hours: report.work_hours ?? null,
      travel_from: report.travel_from ?? null,
      travel_to: report.travel_to ?? null,
      travel_distance_km: (report as any).travel_distance_km ?? null,
      start_time: report.start_time,
      end_time: report.end_time ?? null,
    },
    devices,
    technicianSignature: report.technician_signature,
    customerSignature: report.customer_signature,
  }

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await renderReportPdf(input)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ error: `PDF-Rendering fehlgeschlagen: ${msg}` }, { status: 500 })
  }

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${report.report_number ?? report.id}.pdf"`,
    },
  })
}
