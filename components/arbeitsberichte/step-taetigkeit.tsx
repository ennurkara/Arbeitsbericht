'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { WizardData } from './wizard'

interface StepTaetigkeitProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

export function StepTaetigkeit({ data, onNext }: StepTaetigkeitProps) {
  const [description, setDescription] = useState(data.description)
  const [isLoading, setIsLoading] = useState(false)

  async function handleNext() {
    if (!description.trim()) {
      toast.error('Bitte eine Beschreibung eingeben')
      return
    }
    setIsLoading(true)
    await onNext({ description })
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Ausgeführte Tätigkeit</h2>
      <div className="space-y-1.5">
        <Label htmlFor="description">Beschreibung der durchgeführten Arbeiten *</Label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Welche Arbeiten wurden ausgeführt?"
          rows={7}
          className="w-full rounded-md border border-[var(--rule)] bg-white px-3 py-2 text-[13.5px] text-[var(--ink)]
            tracking-[-0.003em] placeholder:text-[var(--ink-4)] transition-[border-color,box-shadow]
            focus-visible:outline-none focus-visible:border-[var(--blue)] focus-visible:ring-[3px] focus-visible:ring-[var(--blue)]/15
            resize-none"
        />
      </div>
      <Button className="w-full" onClick={handleNext}
        disabled={isLoading || !description.trim()}>
        Weiter →
      </Button>
    </div>
  )
}
