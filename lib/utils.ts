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

// Aufrunden auf die nächste angefangene Viertelstunde. Service-Abrechnung
// erfolgt in 15-Min-Einheiten — eine angebrochene Viertelstunde wird voll
// berechnet. Eingabe und Output beide in Dezimalstunden.
// Beispiele: 2.10 → 2.25, 2.67 → 2.75, 2.75 → 2.75 (no-op), 0 → 0.
export function roundUpToQuarterHour(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0
  // Erst auf ganze Minuten runden, damit Floating-Point-Müll wie
  // 2.75 * 60 = 165.00000000000003 nicht zu einem Sprung auf 3.0 führt.
  const minutes = Math.round(hours * 60)
  const quarterHours = Math.ceil(minutes / 15)
  return Math.round((quarterHours * 15) / 60 * 100) / 100
}

// Arbeitsdauer aus Beginn/Ende. Roh-Differenz wird minutengenau berechnet
// und dann auf die nächste angefangene Viertelstunde aufgerundet, weil die
// Abrechnung in 15-Minuten-Einheiten erfolgt. Beispiel: 2h 40min → 2.75.
export function calculateWorkHours(startIso: string, endIso: string): number {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  const minutes = Math.max(0, Math.round(diffMs / 60000))
  return roundUpToQuarterHour(minutes / 60)
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