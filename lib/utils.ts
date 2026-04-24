import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ModelRef } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function deviceDisplayName(model: ModelRef | null | undefined): string {
  if (!model) return '—'
  const parts = [model.manufacturer?.name, model.modellname, model.variante].filter(Boolean)
  return parts.join(' ') || '—'
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export function calculateWorkHours(startIso: string, endIso: string): number {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  return Math.max(0, Math.round((diffMs / 3600000) * 10) / 10)
}

// `<input type="datetime-local">` erwartet `YYYY-MM-DDTHH:mm` in Lokalzeit.
// `toISOString()` ist UTC — bei DE-Nutzern landet das Feld 1–2h in der Vergangenheit.
// Diese Helper-Funktion liefert den Wert in Browser-Lokalzeit.
export function nowLocalISO16(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 16)
}