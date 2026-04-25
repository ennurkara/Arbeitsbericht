import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'

/**
 * Nimmt ein Foto eines Geräte-Typenschilds / Etiketts entgegen und liefert
 * eine Liste plausibler Seriennummer-Kandidaten zurück.
 *
 * Body: { image: <base64 ohne data: prefix> }
 * Response: { serials: string[] }
 *
 * Pipeline:
 *  1. Mistral OCR → Markdown-Text
 *  2. OpenAI gpt-4o-mini → strukturierte JSON-Antwort mit Seriennummern
 *
 * Wir geben mehrere Kandidaten zurück, weil ein Typenschild oft mehrere
 * IDs zeigt (P/N, M/N, MAC, IMEI, S/N) und der Client gegen die Lager-
 * Datenbank matcht — false positives schaden dort nichts.
 */
export async function POST(req: NextRequest) {
  let body: { image?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }
  if (!body.image) {
    return NextResponse.json({ error: 'image fehlt' }, { status: 400 })
  }

  const mistralKey = process.env.MISTRAL_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  if (!mistralKey || !openaiKey) {
    return NextResponse.json({ error: 'OCR-API-Keys fehlen in der Server-Konfiguration' }, { status: 500 })
  }

  // Step 1: Mistral OCR
  const mistralRes = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mistralKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        image_url: `data:image/jpeg;base64,${body.image}`,
      },
    }),
  })
  if (!mistralRes.ok) {
    const errText = await mistralRes.text().catch(() => '')
    return NextResponse.json(
      { error: 'OCR-Service-Fehler', details: errText.slice(0, 500) },
      { status: 502 },
    )
  }
  const mistralData = await mistralRes.json() as {
    pages?: Array<{ markdown: string }>
  }
  const ocrText = (mistralData.pages ?? []).map(p => p.markdown).join('\n')

  if (!ocrText.trim()) {
    return NextResponse.json({ serials: [] })
  }

  // Step 2: OpenAI strukturiert
  const systemPrompt = `Du extrahierst aus OCR-Text eines Geräte-Typenschilds Seriennummern.

Eine Seriennummer ist typischerweise markiert mit:
- "S/N", "SN", "SN:", "Serial", "Serial No.", "Serial Number", "Serien-Nr.", "Seriennummer"

Nicht verwenden (das sind KEINE Seriennummern):
- MAC-Adresse, IMEI, Part-Number (P/N), Model-Number (M/N), Artikel-Nr., EAN/Barcode, Mfg-Date

Regeln:
- Mehrere Seriennummern sind möglich (z.B. wenn mehrere Geräte aufgenommen wurden) — liste alle gefundenen.
- Nur Werte aus dem OCR-Text, nicht raten.
- Whitespace und Trennzeichen aus der Seriennummer entfernen, ansonsten unverändert übernehmen.
- Wenn keine eindeutige Seriennummer erkennbar: leeres Array.

Ausgabe: ausschließlich JSON { "serials": string[] }.`

  const openai = new OpenAI({ apiKey: openaiKey })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: ocrText },
    ],
    max_tokens: 200,
    response_format: { type: 'json_object' },
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  try {
    const parsed = JSON.parse(raw) as { serials?: unknown }
    const serials = Array.isArray(parsed.serials)
      ? parsed.serials.filter((s): s is string => typeof s === 'string' && s.trim().length >= 3)
      : []
    return NextResponse.json({ serials })
  } catch {
    return NextResponse.json({ serials: [] })
  }
}
