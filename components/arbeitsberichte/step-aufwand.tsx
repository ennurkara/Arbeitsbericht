'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { MapPin, Loader2, Route } from 'lucide-react'
import { calculateWorkHours, formatHoursMinutes, nowLocalISO16 } from '@/lib/utils'
import { detectCurrentAddress, calculateRouteDistance } from '@/lib/geolocation'
import type { WizardData } from './wizard'

const DISTANCE_FORMATTER = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

interface StepAufwandProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

export function StepAufwand({ data, onNext }: StepAufwandProps) {
  const [startTime, setStartTime] = useState(data.startTime || nowLocalISO16())
  const [endTime, setEndTime] = useState(data.endTime)
  const [workHours, setWorkHours] = useState(data.workHours)
  const [travelFrom, setTravelFrom] = useState(data.travelFrom)
  const [travelTo, setTravelTo] = useState(data.travelTo)
  const [distanceKm, setDistanceKm] = useState<number | null>(data.travelDistanceKm)
  const [distanceState, setDistanceState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [locatingField, setLocatingField] = useState<'from' | 'to' | null>(null)

  async function locate(field: 'from' | 'to') {
    setLocatingField(field)
    try {
      const { formatted } = await detectCurrentAddress()
      if (field === 'from') setTravelFrom(formatted)
      else setTravelTo(formatted)
      toast.success(`Standort: ${formatted}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Standort nicht verfügbar'
      toast.error(msg)
    } finally {
      setLocatingField(null)
    }
  }

  useEffect(() => {
    if (startTime && endTime) {
      const auto = calculateWorkHours(
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString()
      )
      if (auto > 0) setWorkHours(String(auto))
    }
  }, [startTime, endTime])

  // Distanz berechnen, sobald beide Felder ≥3 Zeichen — debounced 700ms gegen
  // jede Tastatur-Eingabe. Cleanup-Flag verhindert verspätete Antworten,
  // wenn der User in der Zwischenzeit weitergetippt hat.
  useEffect(() => {
    const from = travelFrom.trim()
    const to = travelTo.trim()
    if (from.length < 3 || to.length < 3) {
      setDistanceKm(null)
      setDistanceState('idle')
      return
    }

    let cancelled = false
    setDistanceState('loading')
    const handle = setTimeout(async () => {
      try {
        const { distanceKm: km } = await calculateRouteDistance(from, to)
        if (cancelled) return
        setDistanceKm(km)
        setDistanceState('idle')
      } catch {
        if (cancelled) return
        setDistanceKm(null)
        setDistanceState('error')
      }
    }, 700)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [travelFrom, travelTo])

  async function handleNext() {
    if (!workHours || parseFloat(workHours) <= 0) {
      toast.error('Bitte Arbeitsaufwand in Stunden angeben')
      return
    }
    setIsLoading(true)
    await onNext({
      startTime,
      endTime,
      workHours,
      travelFrom,
      travelTo,
      travelDistanceKm: distanceKm,
    })
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Aufwand &amp; Anfahrt</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="startTime">Beginn</Label>
          <Input id="startTime" type="datetime-local" value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="max-w-full appearance-none" />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="endTime">Ende</Label>
          <Input id="endTime" type="datetime-local" value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="max-w-full appearance-none" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="workHours">Arbeitsaufwand (Stunden) *</Label>
        <Input id="workHours" type="number" min="0" step="0.01"
          value={workHours} onChange={e => setWorkHours(e.target.value)}
          placeholder="z.B. 2.67" />
        <p className="text-[11.5px] text-[var(--ink-4)]">
          {workHours && parseFloat(workHours) > 0
            ? `${formatHoursMinutes(parseFloat(workHours))} · wird aus Start/Ende minutengenau berechnet, manuell überschreibbar`
            : 'Wird aus Start/Ende minutengenau berechnet, manuell überschreibbar'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="travelFrom">Anfahrt von</Label>
          <div className="flex gap-2">
            <Input id="travelFrom" value={travelFrom}
              onChange={e => setTravelFrom(e.target.value)} placeholder="z.B. Alling" />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => locate('from')}
              disabled={locatingField !== null}
              aria-label="Aktuellen Standort übernehmen"
              title="Aktuellen Standort übernehmen"
            >
              {locatingField === 'from'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <MapPin className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="travelTo">Anfahrt bis</Label>
          <div className="flex gap-2">
            <Input id="travelTo" value={travelTo}
              onChange={e => setTravelTo(e.target.value)} placeholder="z.B. München" />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => locate('to')}
              disabled={locatingField !== null}
              aria-label="Aktuellen Standort übernehmen"
              title="Aktuellen Standort übernehmen"
            >
              {locatingField === 'to'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <MapPin className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {(distanceState !== 'idle' || distanceKm !== null) && (
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-3)]">
          <Route className="h-3.5 w-3.5" strokeWidth={1.75} />
          {distanceState === 'loading' && <span>Distanz wird berechnet…</span>}
          {distanceState === 'error' && (
            <span className="text-[var(--ink-4)]">Distanz nicht ermittelbar</span>
          )}
          {distanceState === 'idle' && distanceKm !== null && (
            <span>
              Distanz: <span className="font-medium text-[var(--ink-2)]">
                {DISTANCE_FORMATTER.format(distanceKm)} km
              </span>
            </span>
          )}
        </div>
      )}

      <Button className="w-full" onClick={handleNext} disabled={isLoading || !workHours}>
        Weiter →
      </Button>
    </div>
  )
}
