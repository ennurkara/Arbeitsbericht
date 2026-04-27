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

// Arbeitsdauer aus Beginn/Ende, minutengenau in Dezimalstunden.
// Beispiel: 2h 1min → 2.02 (= 121 min). Die Billing-Logik (s.
// calculateBillableUnits) entscheidet separat, wie viele ZE abgerechnet
// werden — Roh-Dauer und Abrechnung sind absichtlich getrennt.
export function calculateWorkHours(startIso: string, endIso: string): number {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  const minutes = Math.max(0, Math.round(diffMs / 60000))
  return Math.round((minutes / 60) * 100) / 100
}

// ZE-Abrechnung mit 5-Min-Toleranz:
// - 1 ZE = 15 min
// - Volle Viertelstunden zählen 1:1
// - Eine angefangene Viertelstunde zählt erst AB der 6. Minute
//   (also bei 0–5 min angefangen → 0; bei 6–14 min angefangen → 0,25)
// Beispiele:
//   121 min (8 voll + 1) → 8
//   125 min (8 voll + 5) → 8
//   126 min (8 voll + 6) → 8,25
//   134 min (8 voll + 14) → 8,25
//   135 min (9 voll)     → 9
export function calculateBillableUnits(hours: number | null | undefined): number {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return 0
  const totalMinutes = Math.round(hours * 60)
  const fullQuarters = Math.floor(totalMinutes / 15)
  const partialMin = totalMinutes - fullQuarters * 15
  const partial = partialMin >= 6 ? 0.25 : 0
  return fullQuarters + partial
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