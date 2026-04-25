import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { readFile } from 'fs/promises'
import path from 'path'

// Render-Input. Alles in einem flachen Objekt, damit der API-Handler nur
// einmal aus der DB liest und das hier 100% pure ist (keine Supabase-Calls).
export interface ReportPdfInput {
  reportNumber: string | null
  customer: {
    name: string | null
    address: string | null
    postal_code: string | null
    city: string | null
    phone: string | null
    email: string | null
  }
  technician: { full_name: string | null }
  report: {
    description: string | null
    work_hours: number | null
    travel_from: string | null
    travel_to: string | null
    travel_distance_km: number | null
    start_time: string
    end_time: string | null
  }
  // Devices werden im aktuellen Template nicht direkt abgebildet (das Template
  // hat eine Material-/Leistungs-Tabelle, die anders strukturiert ist als
  // unsere device-Liste). Wir tragen sie in die "Ausgeführte Leistung" ein.
  devices: Array<{ name: string; serial_number: string | null }>
  technicianSignature: string | null // data: URL (PNG)
  customerSignature: string | null   // data: URL (PNG)
}

// ─── Koordinaten ───────────────────────────────────────────────────────────
// pdf-lib nutzt Bottom-Left-Origin. A4 in pt: 595 × 842.
// Werte sind initiale Schätzungen aus der Vorlage und werden iterativ
// verfeinert nach visueller Pruefung.
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842

// Berichtsnummer rechts oben in den Klammern
const REPORT_NUMBER = { x: 460, y: 770, size: 14 }

// Kunde-Tabelle (linke Spalte). Eine Zeile alle ~20pt.
// Werte beginnen bei ungefähr x=110 (nach den Labels "Kunde:", "Straße:" usw.)
const CUSTOMER_X = 110
const CUSTOMER_ROWS = {
  kunde:           700,
  strasse:         680,
  plzOrt:          660,
  ansprechpartner: 640, // wir haben kein Feld dafür, bleibt leer
  telefon:         620,
  email:           600,
  sonstiges:       580,
}

// Ausgeführte Leistung (Multi-Line)
const DESCRIPTION_FIRST_LINE_Y = 538
const DESCRIPTION_LINE_HEIGHT = 14
const DESCRIPTION_X = 60
const DESCRIPTION_MAX_LINES = 9
const DESCRIPTION_MAX_CHARS_PER_LINE = 88

// Datum / Mitarbeiter / Zeit / Anfahrt
const DATUM_X = 110
const DATUM_Y = 207

const MITARBEITER_X = 245
const MITARBEITER_Y = 207

const VON_X = 95
const VON_Y = 187

const BIS_X = 175
const BIS_Y = 187

const ANFAHRT_VON_X = 130
const ANFAHRT_VON_Y = 167

const ANFAHRT_BIS_X = 360
const ANFAHRT_BIS_Y = 167

// Signaturen + Datum unten
const ORT_DATUM_X = 60
const ORT_DATUM_Y = 70

const SIG_TECH_X = 240
const SIG_TECH_Y = 50
const SIG_TECH_W = 140
const SIG_TECH_H = 35

const SIG_KUNDE_X = 430
const SIG_KUNDE_Y = 50
const SIG_KUNDE_W = 140
const SIG_KUNDE_H = 35

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso))
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  if (!text) return []
  const out: string[] = []
  // Source-Newlines respektieren, dann pro Zeile umbrechen.
  for (const para of text.split(/\r?\n/)) {
    if (para.length === 0) {
      out.push('')
      continue
    }
    let remaining = para
    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        out.push(remaining)
        break
      }
      // Wortgrenze finden, sonst hart umbrechen
      let cut = remaining.lastIndexOf(' ', maxChars)
      if (cut <= 0) cut = maxChars
      out.push(remaining.slice(0, cut).trimEnd())
      remaining = remaining.slice(cut).trimStart()
    }
  }
  return out.slice(0, maxLines)
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 10) {
  if (!text) return
  page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) })
}

async function embedSignature(
  pdfDoc: PDFDocument,
  dataUrl: string | null,
): Promise<{ image: any; ratio: number } | null> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return null
  const base64 = dataUrl.split(',')[1]
  if (!base64) return null
  const bytes = Buffer.from(base64, 'base64')
  // react-signature-canvas exportiert standardmäßig PNG.
  const image = await pdfDoc.embedPng(bytes)
  const dims = image.scale(1)
  return { image, ratio: dims.width / dims.height }
}

function fitImage(box: { w: number; h: number }, ratio: number): { w: number; h: number } {
  // Skaliert auf die Box, behält Seitenverhältnis bei.
  const boxRatio = box.w / box.h
  if (ratio > boxRatio) {
    // bildbreiter — width füllt die Box
    return { w: box.w, h: box.w / ratio }
  }
  return { w: box.h * ratio, h: box.h }
}

// ─── Public API ────────────────────────────────────────────────────────────

let cachedTemplateBytes: Uint8Array | null = null

async function loadTemplate(): Promise<Uint8Array> {
  if (cachedTemplateBytes) return cachedTemplateBytes
  const filePath = path.join(process.cwd(), 'public', 'templates', 'arbeitsbericht-vorlage.pdf')
  const buffer = await readFile(filePath)
  cachedTemplateBytes = new Uint8Array(buffer)
  return cachedTemplateBytes
}

export async function renderReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const templateBytes = await loadTemplate()
  const pdfDoc = await PDFDocument.load(templateBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const page = pdfDoc.getPage(0)
  // Fallback wenn Template-Größe abweichen sollte — wir loggen nichts, weil
  // das im Edge-Runtime-Kontext eh ignoriert wird.
  void page.getSize()
  void PAGE_WIDTH
  void PAGE_HEIGHT

  // Berichtsnummer
  drawText(page, font, input.reportNumber ?? '', REPORT_NUMBER.x, REPORT_NUMBER.y, REPORT_NUMBER.size)

  // Kunde
  drawText(page, font, input.customer.name ?? '', CUSTOMER_X, CUSTOMER_ROWS.kunde)
  drawText(page, font, input.customer.address ?? '', CUSTOMER_X, CUSTOMER_ROWS.strasse)
  const plzOrt = [input.customer.postal_code, input.customer.city].filter(Boolean).join(' ')
  drawText(page, font, plzOrt, CUSTOMER_X, CUSTOMER_ROWS.plzOrt)
  // Ansprechpartner haben wir nicht — bleibt leer
  drawText(page, font, input.customer.phone ?? '', CUSTOMER_X, CUSTOMER_ROWS.telefon)
  drawText(page, font, input.customer.email ?? '', CUSTOMER_X, CUSTOMER_ROWS.email)

  // Ausgeführte Leistung — Description + Geräte als Anhang.
  const descParts: string[] = []
  if (input.report.description) descParts.push(input.report.description)
  if (input.devices.length > 0) {
    descParts.push('') // Leerzeile als Trennung
    descParts.push('Eingesetzte Geräte:')
    for (const d of input.devices) {
      const sn = d.serial_number ? ` (SN ${d.serial_number})` : ''
      descParts.push(`- ${d.name}${sn}`)
    }
  }
  const descLines = wrapLines(
    descParts.join('\n'),
    DESCRIPTION_MAX_CHARS_PER_LINE,
    DESCRIPTION_MAX_LINES,
  )
  for (let i = 0; i < descLines.length; i++) {
    drawText(
      page, font,
      descLines[i],
      DESCRIPTION_X,
      DESCRIPTION_FIRST_LINE_Y - i * DESCRIPTION_LINE_HEIGHT,
    )
  }

  // Datum / Mitarbeiter / Zeit / Anfahrt
  drawText(page, font, fmtDate(input.report.start_time), DATUM_X, DATUM_Y)
  drawText(page, font, input.technician.full_name ?? '', MITARBEITER_X, MITARBEITER_Y)
  drawText(page, font, fmtTime(input.report.start_time), VON_X, VON_Y)
  drawText(page, font, fmtTime(input.report.end_time), BIS_X, BIS_Y)

  // Anfahrt mit optionaler Distanz
  drawText(page, font, input.report.travel_from ?? '', ANFAHRT_VON_X, ANFAHRT_VON_Y)
  const travelToText = input.report.travel_distance_km != null
    ? `${input.report.travel_to ?? ''}  (${new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 1, maximumFractionDigits: 1,
      }).format(input.report.travel_distance_km)} km)`
    : input.report.travel_to ?? ''
  drawText(page, font, travelToText, ANFAHRT_BIS_X, ANFAHRT_BIS_Y)

  // Ort/Datum unten links
  const ortDatum = `Alling, ${fmtDate(input.report.start_time)}`
  drawText(page, font, ortDatum, ORT_DATUM_X, ORT_DATUM_Y)

  // Unterschriften
  const techSig = await embedSignature(pdfDoc, input.technicianSignature)
  if (techSig) {
    const fitted = fitImage({ w: SIG_TECH_W, h: SIG_TECH_H }, techSig.ratio)
    page.drawImage(techSig.image, {
      x: SIG_TECH_X + (SIG_TECH_W - fitted.w) / 2,
      y: SIG_TECH_Y + (SIG_TECH_H - fitted.h) / 2,
      width: fitted.w,
      height: fitted.h,
    })
  }
  const kundeSig = await embedSignature(pdfDoc, input.customerSignature)
  if (kundeSig) {
    const fitted = fitImage({ w: SIG_KUNDE_W, h: SIG_KUNDE_H }, kundeSig.ratio)
    page.drawImage(kundeSig.image, {
      x: SIG_KUNDE_X + (SIG_KUNDE_W - fitted.w) / 2,
      y: SIG_KUNDE_Y + (SIG_KUNDE_H - fitted.h) / 2,
      width: fitted.w,
      height: fitted.h,
    })
  }

  return await pdfDoc.save()
}
