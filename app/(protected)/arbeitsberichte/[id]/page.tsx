import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import type { UserRole } from '@/lib/types'

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
      devices:work_report_devices(device:devices(id, name, serial_number))
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  const canView = role === 'admin' || report.technician_id === user.id
  if (!canView) redirect('/arbeitsberichte')

  const devices = (report.devices ?? []).map((d: any) => d.device)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/arbeitsberichte"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-bold text-slate-900">
          {report.report_number ?? 'Entwurf'}
        </h1>
        <Badge variant={report.status === 'abgeschlossen' ? 'default' : 'secondary'}>
          {report.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Entwurf'}
        </Badge>
      </div>

      {report.status === 'entwurf' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-amber-700">Dieser Bericht ist noch nicht abgeschlossen.</p>
          <Button size="sm" asChild>
            <Link href="/arbeitsberichte/neu">Neuer Bericht</Link>
          </Button>
        </div>
      )}

      <div className="bg-white rounded-xl border divide-y">
        <div className="p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Kunde</p>
          <p className="font-medium">{(report.customer as any)?.name ?? '—'}</p>
          {(report.customer as any)?.address && (
            <p className="text-sm text-slate-500">{(report.customer as any).address}</p>
          )}
          {(report.customer as any)?.city && (
            <p className="text-sm text-slate-500">{(report.customer as any).city}</p>
          )}
        </div>

        <div className="p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Techniker & Aufwand</p>
          <p className="font-medium">{(report.technician as any)?.full_name ?? '—'}</p>
          {report.start_time && (
            <p className="text-sm text-slate-500">{formatDateTime(report.start_time)}</p>
          )}
          {report.work_hours && (
            <p className="text-sm text-slate-500">{report.work_hours}h Aufwand</p>
          )}
          {report.travel_from && report.travel_to && (
            <p className="text-sm text-slate-500">
              Anfahrt: {report.travel_from} → {report.travel_to}
            </p>
          )}
        </div>

        {report.description && (
          <div className="p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Ausgeführte Tätigkeit</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.description}</p>
          </div>
        )}

        {devices.length > 0 && (
          <div className="p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Installierte Geräte</p>
            <div className="space-y-2">
              {devices.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium">{d.name}</span>
                  {d.serial_number && (
                    <span className="text-slate-400 font-mono text-xs">{d.serial_number}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.status === 'abgeschlossen' && (
          <div className="p-5 grid grid-cols-2 gap-4">
            {report.technician_signature && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Unterschrift Techniker</p>
                <img src={report.technician_signature} alt="Unterschrift Techniker"
                  className="border rounded-lg h-20 w-full object-contain bg-white" />
              </div>
            )}
            {report.customer_signature && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Unterschrift Kunde</p>
                <img src={report.customer_signature} alt="Unterschrift Kunde"
                  className="border rounded-lg h-20 w-full object-contain bg-white" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}