'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

interface PdfRecoveryProps {
  reportId: string
}

/**
 * Auto-Heilung für Berichte, deren PDF aus irgendeinem Grund nicht persistiert
 * wurde (Browser zu früh geschlossen, Netzaussetzer beim Wizard-Finish, etc.).
 *
 * Wird auf der Detail-Seite gerendert, sobald `status='abgeschlossen' AND
 * pdf_path IS NULL`. Beim Mount feuert sie EINMAL den Render-Endpoint, der
 * server-seitig das PDF erzeugt, in den Storage hochlädt und pdf_path setzt.
 * Bei Erfolg: router.refresh() lädt die Detail-Seite neu — der normale
 * Download-Button und die Server-Komponenten finden dann den frischen
 * pdf_path.
 *
 * Bei Fehler: Banner mit „Erneut versuchen"-Button, ohne Auto-Retry-Loop
 * (sonst hängen wir bei dauerhaft kaputten Berichten in einer Schleife).
 */
export function PdfRecovery({ reportId }: PdfRecoveryProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [state, setState] = useState<'pending' | 'error'>('pending')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Doppelter Mount-Schutz (React StrictMode in dev rendert Effects 2×).
  const triggered = useRef(false)

  async function trigger() {
    setState('pending')
    setErrorMsg(null)
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
      // Erfolg → Server-Component neu laden, dann taucht pdf_path auf.
      startTransition(() => router.refresh())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg)
      setState('error')
    }
  }

  useEffect(() => {
    if (triggered.current) return
    triggered.current = true
    void trigger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  if (state === 'pending') {
    return (
      <div className="rounded-kb border border-[var(--rule)] bg-[var(--paper-2)] p-4 mb-6 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-3)] shrink-0" />
        <div className="text-[13px] text-[var(--ink-2)]">
          PDF wird gerade erstellt und in der Warenwirtschaft gespeichert…
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-kb border border-[var(--amber)] bg-[var(--amber-tint)] p-4 mb-6 flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 text-[var(--amber)] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[var(--ink-2)] font-medium">
          PDF konnte nicht erstellt werden
        </div>
        {errorMsg && (
          <div className="text-[12px] text-[var(--ink-3)] mt-0.5 break-words">
            {errorMsg}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => void trigger()}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rule)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--paper-2)] shrink-0"
      >
        <RefreshCw className="h-3.5 w-3.5" />Erneut versuchen
      </button>
    </div>
  )
}
