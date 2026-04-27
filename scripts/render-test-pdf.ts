// Renders the production PDF (lib/pdf-render.ts) with mock data so the layout
// and the new €/ZE label can be verified end-to-end. Output:
//   tmp/arbeitsbericht-test.pdf
// Use: npx tsx scripts/render-test-pdf.ts [--open]
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderReportPdf, type ReportPdfInput } from '../lib/pdf-render'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const input: ReportPdfInput = {
  reportNumber: 'AB-2026-0042',
  customer: {
    name: 'Musterhof GmbH',
    address: 'Hauptstraße 12',
    postal_code: '82239',
    city: 'Alling',
    phone: '+49 8141 123456',
    email: 'kontakt@musterhof.de',
  },
  technician: { full_name: 'Maxi Hartl' },
  report: {
    description:
      'Bestellung von Bonrollen + USB-Sticks. Versand per DHL ab Lager.',
    work_hours: 21 / 60, // 21 min → 2 ZE
    travel_from: '',
    travel_to: '',
    travel_distance_km: null,
    start_time: '2026-04-27T07:00:00.000Z',
    end_time: '2026-04-27T07:21:00.000Z',
  },
  // Kein Gerät — reine Bestand-Bestellung per Versand
  devices: [],
  stockItems: [
    { name: 'Bonrolle 80×80mm Thermo', quantity: 2 },
    { name: 'USB-Stick 32 GB', quantity: 1 },
  ],
  technicianSignature: BLANK_PNG,
  // Keine Kunden-Unterschrift — DHL-Versand
  customerSignature: null,
}

async function main() {
  const bytes = await renderReportPdf(input)
  const tmpDir = resolve(ROOT, 'tmp')
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })
  const outPath = resolve(tmpDir, 'arbeitsbericht-test.pdf')
  writeFileSync(outPath, bytes)
  console.log(`[ok] PDF written: ${outPath}`)

  if (process.argv.includes('--open')) {
    try {
      execFileSync('cmd', ['/c', 'start', '', outPath], { stdio: 'ignore' })
    } catch {
      // ignore — user can open manually
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
