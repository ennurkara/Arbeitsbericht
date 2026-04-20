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
      <h2 className="text-lg font-semibold text-slate-900">Ausgeführte Tätigkeit</h2>
      <div>
        <Label htmlFor="description">Beschreibung der durchgeführten Arbeiten *</Label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Welche Arbeiten wurden ausgeführt?"
          rows={7}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            resize-none placeholder:text-slate-400"
        />
      </div>
      <Button className="w-full" onClick={handleNext}
        disabled={isLoading || !description.trim()}>
        Weiter →
      </Button>
    </div>
  )
}