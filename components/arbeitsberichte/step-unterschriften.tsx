'use client'

import { useRef, useState, forwardRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
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
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Unterschriften</h2>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">
            Techniker: {technicianName}
          </label>
          <button onClick={() => techRef.current?.clear()}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />Löschen
          </button>
        </div>
        <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
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
          <label className="text-sm font-medium text-slate-700">Unterschrift Kunde</label>
          <button onClick={() => customerRef.current?.clear()}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />Löschen
          </button>
        </div>
        <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
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
        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base font-medium"
        onClick={handleFinish}
        disabled={isLoading}
      >
        {isLoading ? 'Wird verarbeitet...' : '✓ Fertigstellen & PDF erstellen'}
      </Button>
    </div>
  )
}