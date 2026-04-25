'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface PdfActionsProps {
  reportId: string
  reportNumber: string | null
  pdfUrl: string | null
}

export function PdfActions({ reportId, reportNumber, pdfUrl }: PdfActionsProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isRendering, setIsRendering] = useState(false)
  const [, startTransition] = useTransition()

  async function regenerate() {
    setIsRendering(true)
    try {
      const res = await fetch('/api/render-report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      const pdfBlob = await res.blob()

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
    }
  }

  return (
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
        {/* reportNumber currently unused but kept for accessibility/future labels */}
        <span className="sr-only">{reportNumber ?? ''}</span>
      </button>
    </div>
  )
}
