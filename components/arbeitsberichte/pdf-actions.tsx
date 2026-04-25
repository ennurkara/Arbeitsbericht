'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PdfTemplate } from './pdf-template'

interface PdfActionsProps {
  reportId: string
  pdfUrl: string | null
  payload: {
    reportNumber: string | null
    customer: {
      name: string
      address: string | null
      postal_code: string | null
      city: string | null
      phone: string | null
      email: string | null
    }
    technician: { full_name: string }
    report: {
      description: string | null
      work_hours: number | null
      travel_from: string | null
      travel_to: string | null
      travel_distance_km: number | null
      start_time: string
      end_time: string | null
    }
    devices: Array<{ id: string; name: string; serial_number: string | null }>
    technicianSignature: string
    customerSignature: string
  }
}

export function PdfActions({ reportId, pdfUrl, payload }: PdfActionsProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isRendering, setIsRendering] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)
  const [, startTransition] = useTransition()

  async function regenerate() {
    setIsRendering(true)
    setShowTemplate(true)

    // Kurz warten, damit React das PdfTemplate ins DOM mountet, bevor
    // html2canvas drauf zugreift.
    await new Promise(r => setTimeout(r, 250))

    try {
      const { exportReportToPdf } = await import('./pdf-export')
      const pdfBlob = await exportReportToPdf(payload.reportNumber)

      const pdfPath = `${reportId}.pdf`
      const { error: uploadErr } = await supabase.storage
        .from('work-report-pdfs')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true })
      if (uploadErr) {
        toast.error('PDF-Upload fehlgeschlagen', { description: uploadErr.message })
        return
      }

      const { error: saveErr } = await supabase
        .from('work_reports')
        .update({ pdf_path: pdfPath, pdf_uploaded_at: new Date().toISOString() })
        .eq('id', reportId)
      if (saveErr) {
        toast.error('PDF-Pfad konnte nicht gespeichert werden', {
          description: saveErr.message,
        })
        return
      }

      toast.success('PDF wurde neu erzeugt')
      startTransition(() => router.refresh())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('PDF-Erstellung fehlgeschlagen', { description: msg })
    } finally {
      setIsRendering(false)
      setShowTemplate(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> PDF herunterladen
          </a>
        )}
        <button
          onClick={regenerate}
          disabled={isRendering}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rule)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--paper-2)] disabled:opacity-60"
        >
          {isRendering
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
          {pdfUrl ? 'PDF neu erzeugen' : 'PDF erzeugen'}
        </button>
      </div>

      {showTemplate && (
        <PdfTemplate
          reportNumber={payload.reportNumber}
          customer={payload.customer}
          technician={payload.technician}
          report={payload.report}
          devices={payload.devices}
          technicianSignature={payload.technicianSignature}
          customerSignature={payload.customerSignature}
        />
      )}
    </>
  )
}
