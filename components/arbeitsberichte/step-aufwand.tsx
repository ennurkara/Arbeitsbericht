'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { calculateWorkHours, formatHoursMinutes, nowLocalISO16 } from '@/lib/utils'
import type { WizardData } from './wizard'

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
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (startTime && endTime) {
      const auto = calculateWorkHours(
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString()
      )
      if (auto > 0) setWorkHours(String(auto))
    }
  }, [startTime, endTime])

  async function handleNext() {
    if (!workHours || parseFloat(workHours) <= 0) {
      toast.error('Bitte Arbeitsaufwand in Stunden angeben')
      return
    }
    setIsLoading(true)
    await onNext({ startTime, endTime, workHours, travelFrom, travelTo })
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
        <div className="space-y-1.5">
          <Label htmlFor="travelFrom">Anfahrt von</Label>
          <Input id="travelFrom" value={travelFrom}
            onChange={e => setTravelFrom(e.target.value)} placeholder="z.B. Berlin" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="travelTo">Anfahrt bis</Label>
          <Input id="travelTo" value={travelTo}
            onChange={e => setTravelTo(e.target.value)} placeholder="z.B. München" />
        </div>
      </div>

      <Button className="w-full" onClick={handleNext} disabled={isLoading || !workHours}>
        Weiter →
      </Button>
    </div>
  )
}
