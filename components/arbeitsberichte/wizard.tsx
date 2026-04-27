'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { nowLocalISO16 } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import { StepKunde } from './step-kunde'
import { StepTaetigkeit } from './step-taetigkeit'
import { StepGeraete } from './step-geraete'
import { StepAufwand } from './step-aufwand'
import { StepUnterschriften } from './step-unterschriften'

export type AssignmentKind = 'leihe' | 'verkauf' | 'austausch'

export interface DeviceAssignmentChoice {
  kind: AssignmentKind
  /** Bei 'austausch': Geräte-ID, das vom Kunden zurückkommt (geht in Reparatur). */
  swapInDeviceId: string | null
}

export interface WizardData {
  reportId: string | null
  customerId: string
  description: string
  deviceIds: string[]
  /** Pro selektiertem Gerät: Leihe (Default), Verkauf oder Austausch. TSE-Devices
   *  bekommen automatisch 'verkauf' (= installiert) und werden über tseInstallTargets
   *  zusätzlich an eine Kasse gekoppelt. */
  deviceAssignments: Record<string, DeviceAssignmentChoice>
  /** Pro TSE-Device im AB: in welche Kasse wird sie installiert?
   *  Schreibt beim Finish tse_details.installed_in_device. */
  tseInstallTargets: Record<string, string | null>
  /** Bestand-Positionen: model_id → quantity. Bonrollen, Installationsmaterial,
   *  USB-Sticks etc. (Kategorien mit `kind='stock'`). Buchung läuft beim
   *  Finish über die RPC `consume_stock_for_report`. */
  stockSelections: Record<string, number>
  workHours: string
  travelFrom: string
  travelTo: string
  travelDistanceKm: number | null
  startTime: string
  endTime: string
  technicianSignature: string | null
  customerSignature: string | null
}

/** Heuristik: Wenn das Wort „DHL" (case-insensitive) in der Tätigkeit steht,
 *  geht der Versand per Post → keine Kunden-Unterschrift, automatische
 *  DHL-Pauschale auf dem PDF. */
export function isDhlShipment(description: string | null | undefined): boolean {
  if (!description) return false
  return /\bdhl\b/i.test(description)
}

interface WizardProps {
  profile: Profile
  /**
   * Wenn gesetzt, lädt der Wizard einen existierenden Entwurf zur
   * Fortsetzung, statt eine neue Reihe anzulegen. Alle Schritte werden
   * vorbefüllt; saveStep1 erkennt das gesetzte reportId und macht UPDATE
   * statt INSERT.
   */
  initialDraft?: Partial<WizardData> & { reportId: string }
}

const STEP_LABELS = ['Kundendaten', 'Tätigkeit', 'Geräte', 'Aufwand', 'Unterschriften']

export function Wizard({ profile, initialDraft }: WizardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    reportId: initialDraft?.reportId ?? null,
    customerId: initialDraft?.customerId ?? '',
    description: initialDraft?.description ?? '',
    deviceIds: initialDraft?.deviceIds ?? [],
    deviceAssignments: initialDraft?.deviceAssignments ?? {},
    tseInstallTargets: initialDraft?.tseInstallTargets ?? {},
    stockSelections: initialDraft?.stockSelections ?? {},
    workHours: initialDraft?.workHours ?? '',
    travelFrom: initialDraft?.travelFrom ?? 'Parsbergstraße 16, 82239 Alling',
    travelTo: initialDraft?.travelTo ?? '',
    travelDistanceKm: initialDraft?.travelDistanceKm ?? null,
    startTime: initialDraft?.startTime || nowLocalISO16(),
    endTime: initialDraft?.endTime ?? '',
    technicianSignature: initialDraft?.technicianSignature ?? null,
    customerSignature: initialDraft?.customerSignature ?? null,
  })

  function updateData(patch: Partial<WizardData>) {
    setData(prev => ({ ...prev, ...patch }))
  }

  // Heartbeat — setzt updated_at auf der Draft-Row alle 5 Minuten zurück,
  // damit Cleanup (15 Min Inaktivität) den Bericht nicht mitten im Ausfüllen
  // löscht. Nur aktiv wenn ein reportId existiert (also nach Step 1).
  useEffect(() => {
    if (!data.reportId) return
    const id = setInterval(() => {
      // .update mit explizitem updated_at — der BEFORE-UPDATE-Trigger schreibt
      // dann ohnehin now(), aber wir brauchen ein nicht-leeres update-Objekt.
      void supabase
        .from('work_reports')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', data.reportId)
        .then(() => {})
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [data.reportId, supabase])

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
      // Geräte-Junction neu schreiben
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
      // Bestand-Junction neu schreiben — nur die Auswahl, kein Decrement
      // (das passiert atomar beim Finish über consume_stock_for_report).
      await supabase
        .from('work_report_stock_items')
        .delete()
        .eq('work_report_id', merged.reportId)
      const stockEntries = Object.entries(merged.stockSelections).filter(([, q]) => q > 0)
      if (stockEntries.length > 0) {
        await supabase
          .from('work_report_stock_items')
          .insert(
            stockEntries.map(([modelId, quantity]) => ({
              work_report_id: merged.reportId!,
              model_id: modelId,
              quantity,
            }))
          )
      }
      // Touch der Parent-Row, damit der updated_at-Trigger feuert.
      await supabase
        .from('work_reports')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', merged.reportId)
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

    // Pro Gerät die assign_device-RPC mit der gewählten Aktion (Leihe / Verkauf
     // / Austausch) aufrufen. Setzt atomar Status + current_customer_id +
     // schreibt eine device_assignments-Historienzeile (verlinkt mit dem AB).
     // Bei Fehler: Bericht zurück auf 'entwurf' rollen und abbrechen, sonst
     // bleibt der AB als 'abgeschlossen' liegen, ohne dass die Geräte-Buchung
     // tatsächlich geschrieben wurde — wäre ein inkonsistenter Zustand.
     for (const deviceId of merged.deviceIds) {
       const choice = merged.deviceAssignments[deviceId] ?? { kind: 'leihe' as const, swapInDeviceId: null }
       const { error: assignErr } = await supabase.rpc('assign_device', {
         p_device_id: deviceId,
         p_customer_id: merged.customerId,
         p_kind: choice.kind,
         p_swap_in_device_id: choice.swapInDeviceId,
         p_work_report_id: merged.reportId,
         p_notes: null,
       })
       if (assignErr) {
         await supabase
           .from('work_reports')
           .update({
             status: 'entwurf',
             technician_signature: null,
             customer_signature: null,
             completed_at: null,
           })
           .eq('id', merged.reportId)
         toast.error('Geräte-Zuordnung fehlgeschlagen', {
           description: `${assignErr.message} — Bericht zurück auf Entwurf gesetzt, bitte Geräteauswahl korrigieren.`,
         })
         return
       }
     }

    // Bestand abbuchen — atomar pro Position via RPC. Bei Fehler: Bericht
    // zurück auf 'entwurf' (analog zum Geräte-Block oben). Bereits gebuchte
    // Positionen bleiben gebucht, aber bei einem Retry stellt
    // consume_stock_for_report über UPSERT konsistente Mengen wieder her.
    const stockEntries = Object.entries(merged.stockSelections).filter(([, q]) => q > 0)
    for (const [modelId, qty] of stockEntries) {
      const { error: stockErr } = await supabase.rpc('consume_stock_for_report', {
        p_model_id: modelId,
        p_quantity: qty,
        p_work_report_id: merged.reportId,
      })
      if (stockErr) {
        await supabase
          .from('work_reports')
          .update({
            status: 'entwurf',
            technician_signature: null,
            customer_signature: null,
            completed_at: null,
          })
          .eq('id', merged.reportId)
        toast.error('Bestand-Buchung fehlgeschlagen', {
          description: `${stockErr.message} — Bericht zurück auf Entwurf.`,
        })
        return
      }
    }

    // TSE-Module mit Ziel-Kasse koppeln: tse_details.installed_in_device setzen.
    // Optional vorher: alte TSE in derselben Kasse als ausgemustert markieren —
    // bewusst weggelassen, weil das den Wizard für den Standardfall (1 alte +
    // 1 neue TSE in 1 Kasse) ungefragt invasiv macht; manueller Cleanup im
    // Inventar bleibt klarer.
    const tseTargets = merged.tseInstallTargets ?? {}
    for (const [tseDeviceId, kasseDeviceId] of Object.entries(tseTargets)) {
      if (!kasseDeviceId) continue
      // UPDATE statt UPSERT: tse_details.kind ist NOT NULL und wird beim Anlegen
      // im Warenwirtschaft-DeviceForm gesetzt. Wenn die Zeile fehlt, läuft der
      // UPDATE leer durch — wir warnen, aber blockieren den Wizard nicht.
      const { data: updated, error: tseErr } = await supabase
        .from('tse_details')
        .update({ installed_in_device: kasseDeviceId })
        .eq('device_id', tseDeviceId)
        .select('device_id')
      if (tseErr) {
        toast.error('TSE-Kopplung fehlgeschlagen', { description: tseErr.message })
      } else if (!updated || updated.length === 0) {
        toast.warning('TSE-Detailzeile fehlt', {
          description: 'Bitte TSE im Inventar mit Art (USB/SD), BSI-Nummer und Ablauf anlegen, dann Bericht öffnen und erneut speichern.',
        })
      }
    }

    setTimeout(async () => {
      let pdfBlob: Blob | null = null
      try {
        const res = await fetch('/api/render-report-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId: merged.reportId }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error ?? `HTTP ${res.status}`)
        }
        pdfBlob = await res.blob()
        // Lokal speichern für den Techniker
        const a = document.createElement('a')
        a.href = URL.createObjectURL(pdfBlob)
        a.download = `${reportRow?.report_number ?? merged.reportId}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(a.href)
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
            } else {
              // PDF ist hochgeladen, optional an den Kunden mailen wenn er
              // eine E-Mail-Adresse hat. Fehler hier blockieren den Wizard
              // nicht — der Bericht ist trotzdem fertig.
              try {
                const res = await fetch('/api/send-report-pdf', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reportId: merged.reportId }),
                })
                const json = await res.json().catch(() => ({}))
                if (res.ok) {
                  toast.success(`PDF an Kunde gesendet (${json.sentTo ?? ''})`)
                } else if (json.error === 'Kunde hat keine E-Mail-Adresse') {
                  // Stiller Skip — kein Fehler, einfach nicht versenden.
                } else {
                  toast.error('PDF-Versand an Kunde fehlgeschlagen', {
                    description: json.error ?? `HTTP ${res.status}`,
                  })
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                toast.error('PDF-Versand an Kunde fehlgeschlagen', { description: msg })
              }
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

      {/* PDF wird server-seitig in /api/render-report-pdf erzeugt — kein hidden React-Template mehr nötig. */}
    </div>
  )
}
