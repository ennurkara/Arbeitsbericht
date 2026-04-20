'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import { StepKunde } from './step-kunde'
import { StepTaetigkeit } from './step-taetigkeit'
import { StepGeraete } from './step-geraete'
import { StepAufwand } from './step-aufwand'
import { StepUnterschriften } from './step-unterschriften'
import { PdfTemplate } from './pdf-template'

export interface WizardData {
  reportId: string | null
  customerId: string
  description: string
  deviceIds: string[]
  workHours: string
  travelFrom: string
  travelTo: string
  startTime: string
  endTime: string
  technicianSignature: string | null
  customerSignature: string | null
}

interface WizardProps {
  profile: Profile
}

const STEP_LABELS = ['Kundendaten', 'Tätigkeit', 'Geräte', 'Aufwand', 'Unterschriften']

export function Wizard({ profile }: WizardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    reportId: null,
    customerId: '',
    description: '',
    deviceIds: [],
    workHours: '',
    travelFrom: '',
    travelTo: '',
    startTime: new Date().toISOString().slice(0, 16),
    endTime: '',
    technicianSignature: null,
    customerSignature: null,
  })

  const [showPdf, setShowPdf] = useState(false)
  const [pdfPayload, setPdfPayload] = useState<any>(null)

  function updateData(patch: Partial<WizardData>) {
    setData(prev => ({ ...prev, ...patch }))
  }

  async function saveStep1(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (!merged.reportId) {
      const { data: created, error } = await supabase
        .from('work_reports')
        .insert({
          customer_id: merged.customerId,
          technician_id: profile.id,
          start_time: new Date().toISOString(),
          status: 'entwurf',
        })
        .select()
        .single()
      if (error || !created) {
        toast.error('Fehler beim Speichern des Entwurfs')
        return
      }
      updateData({ reportId: created.id })
    } else {
      await supabase
        .from('work_reports')
        .update({ customer_id: merged.customerId })
        .eq('id', merged.reportId)
    }
    setStep(2)
  }

  async function saveStep2(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (merged.reportId) {
      await supabase
        .from('work_reports')
        .update({ description: merged.description })
        .eq('id', merged.reportId)
    }
    setStep(3)
  }

  async function saveStep3(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (merged.reportId) {
      await supabase
        .from('work_report_devices')
        .delete()
        .eq('work_report_id', merged.reportId)
      if (merged.deviceIds.length > 0) {
        await supabase
          .from('work_report_devices')
          .insert(
            merged.deviceIds.map(deviceId => ({
              work_report_id: merged.reportId!,
              device_id: deviceId,
            }))
          )
      }
    }
    setStep(4)
  }

  async function saveStep4(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (merged.reportId) {
      await supabase
        .from('work_reports')
        .update({
          work_hours: parseFloat(merged.workHours),
          travel_from: merged.travelFrom || null,
          travel_to: merged.travelTo || null,
          start_time: merged.startTime ? new Date(merged.startTime).toISOString() : undefined,
          end_time: merged.endTime ? new Date(merged.endTime).toISOString() : null,
        })
        .eq('id', merged.reportId)
    }
    setStep(5)
  }

  async function handleFinish(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (!merged.reportId) {
      toast.error('Kein aktiver Bericht gefunden')
      return
    }

    const { error } = await supabase
      .from('work_reports')
      .update({
        status: 'abgeschlossen',
        technician_signature: merged.technicianSignature,
        customer_signature: merged.customerSignature,
        completed_at: new Date().toISOString(),
      })
      .eq('id', merged.reportId)

    if (error) {
      toast.error('Fehler beim Abschließen des Berichts')
      return
    }

    const { data: reportRow } = await supabase
      .from('work_reports')
      .select('report_number')
      .eq('id', merged.reportId)
      .single()

    for (const deviceId of merged.deviceIds) {
      await supabase
        .from('devices')
        .update({ status: 'im_einsatz' })
        .eq('id', deviceId)
      await supabase
        .from('device_movements')
        .insert({
          device_id: deviceId,
          user_id: profile.id,
          action: 'entnahme',
          quantity: 1,
          note: `Arbeitsbericht ${reportRow?.report_number ?? merged.reportId}`,
        })
    }

    const [{ data: customerRow }, { data: deviceRows }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', merged.customerId).single(),
      merged.deviceIds.length > 0
        ? supabase.from('devices').select('id, name, serial_number').in('id', merged.deviceIds)
        : Promise.resolve({ data: [] }),
    ])

    setPdfPayload({
      customer: customerRow,
      devices: deviceRows ?? [],
      reportNumber: reportRow?.report_number ?? null,
      report: {
        description: merged.description,
        work_hours: parseFloat(merged.workHours),
        travel_from: merged.travelFrom,
        travel_to: merged.travelTo,
        start_time: merged.startTime ? new Date(merged.startTime).toISOString() : new Date().toISOString(),
        end_time: merged.endTime ? new Date(merged.endTime).toISOString() : null,
      },
      technicianSignature: merged.technicianSignature!,
      customerSignature: merged.customerSignature!,
    })
    setShowPdf(true)

    setTimeout(async () => {
      try {
        const { exportReportToPdf } = await import('./pdf-export')
        await exportReportToPdf(reportRow?.report_number ?? null)
        toast.success('PDF wurde heruntergeladen')
      } catch {
        toast.error('Fehler beim Erstellen des PDFs')
      }
      router.push('/arbeitsberichte')
    }, 400)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-600">
            Schritt {step} von {STEP_LABELS.length}
          </span>
          <span className="text-sm text-slate-500">{STEP_LABELS[step - 1]}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${(step / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-xl border p-6">
        {step === 1 && <StepKunde data={data} onNext={saveStep1} />}
        {step === 2 && <StepTaetigkeit data={data} onNext={saveStep2} />}
        {step === 3 && <StepGeraete data={data} onNext={saveStep3} />}
        {step === 4 && <StepAufwand data={data} onNext={saveStep4} />}
        {step === 5 && (
          <StepUnterschriften
            data={data}
            technicianName={profile.full_name}
            onFinish={handleFinish}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 1 && step <= 5 ? (
          <button onClick={() => setStep(s => s - 1)}
            className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
            ← Zurück
          </button>
        ) : step === 1 ? (
          <button onClick={() => router.push('/arbeitsberichte')}
            className="text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
        ) : null}
      </div>

      {/* Hidden PDF template */}
      {showPdf && pdfPayload && (
        <PdfTemplate
          reportNumber={pdfPayload.reportNumber}
          customer={pdfPayload.customer}
          technician={profile}
          report={pdfPayload.report}
          devices={pdfPayload.devices}
          technicianSignature={pdfPayload.technicianSignature}
          customerSignature={pdfPayload.customerSignature}
        />
      )}
    </div>
  )
}