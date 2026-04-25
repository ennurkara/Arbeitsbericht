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

// Arbeitsdauer aus Beginn/Ende, auf die Minute gerundet und als Dezimal-
// stunden zurückgegeben. Der DB-Typ ist numeric(5,2), also reicht 1/60 ≈ 0.02
// Auflösung. Beispiel: 2h 40min → 2.67.
export function calculateWorkHours(startIso: string, endIso: string): number {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  const minutes = Math.max(0, Math.round(diffMs / 60000))
  return Math.round((minutes / 60) * 100) / 100
}

// Formatiert Dezimalstunden als "Xh Ymin" für die Anzeige.
export function formatHoursMinutes(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—'
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

// `<input type="datetime-local">` erwartet `YYYY-MM-DDTHH:mm` in Lokalzeit.
// `toISOString()` ist UTC — bei DE-Nutzern landet das Feld 1–2h in der Vergangenheit.
// Diese Helper-Funktion liefert den Wert in Browser-Lokalzeit.
export function nowLocalISO16(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 16)
}

// ISO-Timestamp (UTC) → `YYYY-MM-DDTHH:mm` in Browser-Lokalzeit. Gegenstück
// zu nowLocalISO16, wenn man einen DB-Wert wieder in einen datetime-local-
// Input prefillen möchte. Liefert leeren String wenn Input null/undef ist.
export function isoToLocalISO16(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 16)
}