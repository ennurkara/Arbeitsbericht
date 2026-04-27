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

// Heuristik: Wenn das Wort „DHL" (case-insensitive) in der Tätigkeit steht,
// geht der Versand per Post → keine Kunden-Unterschrift, keine Anfahrt /
// Arbeitszeit, automatische DHL-Pauschale auf dem PDF. Single source of truth
// für Wizard + PDF-Renderer.
export function isDhlShipment(description: string | null | undefined): boolean {
  if (!description) return false
  return /\bdhl\b/i.test(description)
}

// ZE-Abrechnung in ganzen Zeiteinheiten:
// - 1 ZE = 15 min
// - Sobald gearbeitet wird, wird sofort 1 ZE gestellt (kein Toleranz-Fenster
//   für die 1. Viertelstunde — von 0:01 bis 0:15 sind 1 ZE).
// - Jede WEITERE angefangene Viertelstunde hat 5 Minuten Toleranz: erst ab
//   der 6. Min des jeweiligen Viertels wird sie berechnet.
// Schwellen: k-tes Viertel (k ≥ 2) ab 15·(k−1)+6 Min → ZE = k.
// Beispiele:
//   1 min  → 1
//   15 min → 1   (1. Viertel komplett, 2. noch nicht angefangen)
//   20 min → 1   (2. angefangen, in Toleranz)
//   21 min → 2   (2. über Toleranz)
//   35 min → 2
//   36 min → 3
//   60 min → 4
//   121 min → 8  (letzte Schwelle bei min 111, nächste bei 126)
//   126 min → 9
export function calculateBillableUnits(hours: number | null | undefined): number {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return 0
  const totalMinutes = Math.round(hours * 60)
  if (totalMinutes <= 0) return 0
  // floor((T+9)/15) zählt, wie viele k-te Viertel ihre Schwelle (15k−9 min)
  // überschritten haben — ab k=2 mit 5-Min-Toleranz. Für T>0 garantiert
  // max(1, …), dass das 1. Viertel ohne Toleranz sofort als 1 ZE zählt.
  return Math.max(1, Math.floor((totalMinutes + 9) / 15))
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