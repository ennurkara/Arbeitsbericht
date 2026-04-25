import { PDFDocument, type PDFForm } from 'pdf-lib'
import { readFile } from 'fs/promises'
import path from 'path'

// Render-Input. Alles in einem flachen Objekt, damit der API-Handler nur
// einmal aus der DB liest und das hier 100% pure ist.
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
  devices: Array<{ name: string; serial_number: string | null }>
  technicianSignature: string | null // data:image/png;base64,...
  customerSignature: string | null
}

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

function fmtKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km <= 0) return ''
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(km)
}

function fmtHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h) || h <= 0) return ''
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(h)
}

/** Wickelt Text auf maxLines Zeilen mit ca. maxChars pro Zeile (Heuristik). */
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  if (!text) return []
  const out: string[] = []
  for (const para of text.split(/\r?\n/)) {
    if (para.length === 0) {
      out.push('')
      if (out.length >= maxLines) return out
      continue
    }
    let remaining = para
    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        out.push(remaining)
        if (out.length >= maxLines) return out
        break
      }
      let cut = remaining.lastIndexOf(' ', maxChars)
      if (cut <= 0) cut = maxChars
      out.push(remaining.slice(0, cut).trimEnd())
      if (out.length >= maxLines) return out
      remaining = remaining.slice(cut).trimStart()
    }
  }
  return out
}

function setText(form: PDFForm, name: string, value: string | null | undefined) {
  if (value == null || value === '') return
  try {
    form.getTextField(name).setText(value)
  } catch {
    // Feld nicht vorhanden — ignorieren statt Render abbrechen
  }
}

function checkBox(form: PDFForm, name: string, checked: boolean) {
  if (!checked) return
  try {
    form.getCheckBox(name).check()
  } catch {
    // Feld nicht vorhanden
  }
}

async function embedSignaturePng(
  pdfDoc: PDFDocument,
  dataUrl: string | null,
) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return null
  const base64 = dataUrl.split(',')[1]
  if (!base64) return null
  const bytes = Buffer.from(base64, 'base64')
  return await pdfDoc.embedPng(bytes)
}

function fitImage(box: { w: number; h: number }, ratio: number) {
  // Skaliert auf die Box, behält Seitenverhältnis bei.
  const boxRatio = box.w / box.h
  if (ratio > boxRatio) return { w: box.w, h: box.w / ratio }
  return { w: box.h * ratio, h: box.h }
}

/** Detect Vectron / APRO / HPF / Lieferschein / Installation aus dem Geräte-Set
 *  und der Beschreibung — best-effort, schadet nicht wenn falsch. */
function detectServices(input: ReportPdfInput) {
  const haystack = [
    input.report.description ?? '',
    ...input.devices.map(d => d.name),
  ].join(' ').toLowerCase()
  return {
    lieferschein: /lieferschein/i.test(haystack),
    installation: /installation|installiert|montage/i.test(haystack),
    vectron:      /vectron/i.test(haystack),
    apro:         /\bapro\b/i.test(haystack),
    hpf:          /\bhpf\b/i.test(haystack),
  }
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
  const form = pdfDoc.getForm()
  const page = pdfDoc.getPage(0)

  // ─── Customer block ──────────────────────────────────────────────────
  setText(form, 'kb_kunde', input.customer.name)
  setText(form, 'kb_strasse', input.customer.address)
  const plzOrt = [input.customer.postal_code, input.customer.city].filter(Boolean).join(' ')
  setText(form, 'kb_plz_ort', plzOrt)
  setText(form, 'kb_telefon', input.customer.phone)
  setText(form, 'kb_email', input.customer.email)
  // kb_ansprechpartner + kb_sonstiges: kein Datenfeld in unserem Modell -> leer

  // ─── Service checkboxes (best-effort heuristic) ──────────────────────
  const svc = detectServices(input)
  checkBox(form, 'kb_svc_lieferschein', svc.lieferschein)
  checkBox(form, 'kb_svc_installation', svc.installation)
  checkBox(form, 'kb_svc_vectron', svc.vectron)
  checkBox(form, 'kb_svc_apro', svc.apro)
  checkBox(form, 'kb_svc_hpf', svc.hpf)

  // ─── Ausgeführte Leistung ────────────────────────────────────────────
  // Description komplett auf z1..z6 verteilen — die ehemalige Titel-Zeile
  // (kb_leistung_titel) wurde aus der Vorlage entfernt, also fängt der
  // Text direkt in der ersten linierten Zeile an.
  const descLines = wrapLines(input.report.description ?? '', 90, 6)
  for (let i = 1; i <= 6; i++) {
    setText(form, `kb_leistung_z${i}`, descLines[i - 1] ?? '')
  }

  // ─── Material-Tabelle: pro eingesetztes Gerät 1 Zeile (Menge=1) ──────
  // 14 Zeilen verfügbar, alles darüber wird abgeschnitten.
  const maxRows = 14
  for (let i = 0; i < Math.min(input.devices.length, maxRows); i++) {
    const d = input.devices[i]
    const row = i + 1
    setText(form, `kb_m_menge_${row}`, '1')
    setText(form, `kb_m_text_${row}`, d.name)
    setText(form, `kb_m_serial_${row}`, d.serial_number ?? '')
  }

  // ─── Zeit-Block ──────────────────────────────────────────────────────
  setText(form, 'kb_datum', fmtDate(input.report.start_time))
  setText(form, 'kb_mitarbeiter', input.technician.full_name)
  setText(form, 'kb_zeit_von', fmtTime(input.report.start_time))
  setText(form, 'kb_zeit_bis', fmtTime(input.report.end_time))
  // ZE = Zeiteinheiten (1 Std. = 6 ZE). Wir tragen die Stunden ein.
  setText(form, 'kb_ze', fmtHours(input.report.work_hours))

  // ─── Anfahrt ─────────────────────────────────────────────────────────
  // Distanz-km hinten an "bis" anhängen, falls vorhanden.
  const km = fmtKm(input.report.travel_distance_km)
  setText(form, 'kb_anfahrt_von', input.report.travel_from)
  setText(form, 'kb_anfahrt_bis',
    input.report.travel_to
      ? km ? `${input.report.travel_to}  (${km} km)` : input.report.travel_to
      : null)

  // ─── Unterschriften (Vorbereitung) ────────────────────────────────────
  // Ort/Datum als Text, KB- + Kunden-Signaturen folgen als PNG-Overlay
  // NACH dem flatten() — sonst übermalt flatten unsere drawImage-Aufrufe.
  setText(form, 'kb_ort_datum', `Alling, ${fmtDate(input.report.start_time)}`)

  // Rechtecke der Unterschrift-Felder VOR flatten cachen (danach sind die
  // Widgets weg).
  type Rect = { x: number; y: number; width: number; height: number }
  const sigRects: Record<string, Rect | null> = {
    kb_unterschrift_kb: null,
    kb_unterschrift_kunde: null,
  }
  for (const name of Object.keys(sigRects)) {
    try {
      const widget = form.getTextField(name).acroField.getWidgets()[0]
      const r = widget.getRectangle()
      sigRects[name] = { x: r.x, y: r.y, width: r.width, height: r.height }
    } catch {
      // Feld fehlt — wird im Overlay einfach übersprungen
    }
  }

  // ─── Bericht-Nr — Vorlage zeigt oben rechts "( 000402 )", erwartet nur
  // den Zähl-Suffix ohne "AB-" und ohne Jahr. Aus "AB-2026-0007" wird "0007".
  // Das Feld ist klein (58×14pt) → explizite, größere Font-Size erzwingen,
  // sonst rendert pdf-lib es winzig.
  const numericSuffix = (input.reportNumber ?? '').match(/(\d+)\s*$/)?.[1] ?? null
  if (numericSuffix) {
    try {
      const tf = form.getTextField('kb_bericht_nr')
      tf.setText(numericSuffix)
      tf.setFontSize(13)
    } catch {
      // Feld nicht vorhanden — alte Vorlage ohne Bericht-Nr-Feld
    }
  }

  // ─── Form flatten — fertige PDF, nicht mehr nachträglich editierbar.
  form.flatten()

  // ─── Unterschriften ZULETZT als PNG drüberzeichnen
  // Das AcroForm-Feld ist mit 16pt Höhe schmal — wir vergrößern den Render-
  // Bereich auf SIGNATURE_BOX_HEIGHT pt nach oben, sodass die handschrift-
  // liche Signatur deutlich lesbar ist. Die Linie unter dem Feld bleibt
  // sichtbar (Bild sitzt direkt darüber).
  const SIGNATURE_BOX_HEIGHT = 40
  async function overlaySignature(rectKey: string, dataUrl: string | null) {
    const rect = sigRects[rectKey]
    if (!rect || !dataUrl) return
    const png = await embedSignaturePng(pdfDoc, dataUrl)
    if (!png) return
    const box = { w: rect.width - 8, h: SIGNATURE_BOX_HEIGHT }
    const ratio = png.width / png.height
    const fitted = fitImage(box, ratio)
    page.drawImage(png, {
      // Horizontal mittig in der Spalte
      x: rect.x + (rect.width - fitted.w) / 2,
      // Vertikal: Bild sitzt MIT seiner Unterkante auf der Feld-Unterkante
      // (= direkt auf der Unterschriftslinie), wächst nach oben.
      y: rect.y + 1,
      width: fitted.w,
      height: fitted.h,
    })
  }
  await overlaySignature('kb_unterschrift_kb', input.technicianSignature)
  await overlaySignature('kb_unterschrift_kunde', input.customerSignature)

  return await pdfDoc.save()
}
