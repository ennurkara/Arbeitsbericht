'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface PdfActionsProps {
  reportId: string
  reportNumber: string | null
  pdfUrl: string | null
}

export function PdfActions({ reportId, reportNumber, pdfUrl }: PdfActionsProps) {
  const router = useRouter()
  const [isRendering, setIsRendering] = useState(false)
  const [, startTransition] = useTransition()

  async function regenerate() {
    setIsRendering(true)
    try {
      // Endpoint kümmert sich um Render + Upload + pdf_path-Save in einer
      // Server-Transaktion. 2xx heißt: alles persistiert.
      const res = await fetch('/api/render-report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
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
