'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { deviceDisplayName, nowLocalISO16 } from '@/lib/utils'
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
  travelDistanceKm: number | null
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
    travelFrom: 'Alling, Parsbergstraße 16, 82239',
    travelTo: '',
    travelDistanceKm: null,
    startTime: nowLocalISO16(),
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
        toast.error('Fehler beim Speichern des Entwurfs', {
          description: error?.message ?? 'Unbekannter Fehler',
        })
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
          travel_distance_km: merged.travelDistanceKm,
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

    if (merged.deviceIds.length > 0) {
      await supabase
        .from('devices')
        .update({ status: 'im_einsatz' })
        .in('id', merged.deviceIds)
    }

    const [{ data: customerRow }, { data: deviceRows }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', merged.customerId).single(),
      merged.deviceIds.length > 0
        ? supabase
            .from('devices')
            .select(`
              id,
              serial_number,
              model:models(modellname, variante, manufacturer:manufacturers(name))
            `)
            .in('id', merged.deviceIds)
        : Promise.resolve({ data: [] as Array<{ id: string; serial_number: string | null; model: any }> }),
    ])

    const pdfDevices = (deviceRows ?? []).map((d: any) => ({
      id: d.id,
      name: deviceDisplayName(d.model),
      serial_number: d.serial_number,
    }))

    setPdfPayload({
      customer: customerRow,
      devices: pdfDevices,
      reportNumber: reportRow?.report_number ?? null,
      report: {
        description: merged.description,
        work_hours: parseFloat(merged.workHours),
        travel_from: merged.travelFrom,
        travel_to: merged.travelTo,
        travel_distance_km: merged.travelDistanceKm,
        start_time: merged.startTime ? new Date(merged.startTime).toISOString() : new Date().toISOString(),
        end_time: merged.endTime ? new Date(merged.endTime).toISOString() : null,
      },
      technicianSignature: merged.technicianSignature!,
      customerSignature: merged.customerSignature!,
    })
    setShowPdf(true)

    setTimeout(async () => {
      let pdfBlob: Blob | null = null
      try {
        const { exportReportToPdf } = await import('./pdf-export')
        pdfBlob = await exportReportToPdf(reportRow?.report_number ?? null)
        toast.success('PDF wurde heruntergeladen')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error('Fehler beim Erstellen des PDFs', { description: msg })
      }

      if (pdfBlob) {
        try {
          const pdfPath = `${merged.reportId}.pdf`
          const { error: uploadErr } = await supabase.storage
            .from('work-report-pdfs')
            .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true })
          if (uploadErr) {
            toast.error('PDF-Upload in die Warenwirtschaft fehlgeschlagen', {
              description: uploadErr.message,
            })
          } else {
            const { error: saveErr } = await supabase
              .from('work_reports')
              .update({ pdf_path: pdfPath, pdf_uploaded_at: new Date().toISOString() })
              .eq('id', merged.reportId)
            if (saveErr) {
              toast.error('PDF-Pfad konnte nicht gespeichert werden', {
                description: saveErr.message,
              })
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          toast.error('Unerwarteter Fehler beim PDF-Upload', { description: msg })
        }
      }

      router.push('/arbeitsberichte')
    }, 400)
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-[var(--blue)]">
            Schritt {step} von {STEP_LABELS.length}
          </span>
          <span className="text-[12px] text-[var(--ink-3)]">{STEP_LABELS[step - 1]}</span>
        </div>
        <div className="kb-bar">
          <span style={{ width: `${(step / STEP_LABELS.length) * 100}%` }} />
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-kb border border-[var(--rule)] p-4 sm:p-6 shadow-xs">
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
      <div className="flex justify-between mt-4">
        {step > 1 && step <= 5 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            className="text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            ← Zurück
          </button>
        ) : step === 1 ? (
          <button
            onClick={() => router.push('/arbeitsberichte')}
            className="text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
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
