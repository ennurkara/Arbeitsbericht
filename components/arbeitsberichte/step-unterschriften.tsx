'use client'

import { useRef, useState, forwardRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RotateCcw, Check } from 'lucide-react'
import type { WizardData } from './wizard'

const SignaturePad = forwardRef<SignatureCanvas, { canvasProps: any; backgroundColor: string }>(
  function SignaturePad(props, ref) {
    return <SignatureCanvas ref={ref} {...props} />
  }
)
SignaturePad.displayName = 'SignaturePad'

interface StepUnterschriftenProps {
  data: WizardData
  technicianName: string
  onFinish: (patch: Partial<WizardData>) => Promise<void>
}

export function StepUnterschriften({ data, technicianName, onFinish }: StepUnterschriftenProps) {
  const techRef = useRef<SignatureCanvas>(null)
  const customerRef = useRef<SignatureCanvas>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleFinish() {
    if (techRef.current?.isEmpty() ?? true) {
      toast.error('Bitte Techniker-Unterschrift hinzufügen')
      return
    }
    if (customerRef.current?.isEmpty() ?? true) {
      toast.error('Bitte Kunden-Unterschrift hinzufügen')
      return
    }
    setIsLoading(true)
    await onFinish({
      technicianSignature: techRef.current!.toDataURL('image/png'),
      customerSignature: customerRef.current!.toDataURL('image/png'),
    })
    setIsLoading(false)
  }

  return (
    <div className="space-y-5">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Unterschriften</h2>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-medium text-[var(--ink-2)]">
            Techniker: <span className="text-[var(--ink)]">{technicianName}</span>
          </label>
          <button
            type="button"
            onClick={() => techRef.current?.clear()}
            className="text-[11.5px] text-[var(--ink-3)] hover:text-[var(--ink)] flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />Löschen
          </button>
        </div>
        <div className="border-2 border-dashed border-[var(--rule)] rounded-md overflow-hidden bg-white">
          <SignaturePad
            ref={techRef}
            canvasProps={{
              className: 'w-full touch-none',
              style: { height: '150px', display: 'block' },
            }}
            backgroundColor="white"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-medium text-[var(--ink-2)]">Unterschrift Kunde</label>
          <button
            type="button"
            onClick={() => customerRef.current?.clear()}
            className="text-[11.5px] text-[var(--ink-3)] hover:text-[var(--ink)] flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />Löschen
          </button>
        </div>
        <div className="border-2 border-dashed border-[var(--rule)] rounded-md overflow-hidden bg-white">
          <SignaturePad
            ref={customerRef}
            canvasProps={{
              className: 'w-full touch-none',
              style: { height: '150px', display: 'block' },
            }}
            backgroundColor="white"
          />
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={handleFinish}
        disabled={isLoading}
      >
        {isLoading ? 'Wird verarbeitet...' : (
          <>
            <Check className="h-4 w-4" />Fertigstellen &amp; PDF erstellen
          </>
        )}
      </Button>
    </div>
  )
}
