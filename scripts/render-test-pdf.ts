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
      'TSE-Wechsel an Kasse 1.\nAlte TSE (SN 100123) ausgebaut, Status auf "ausgemustert" gesetzt. Neue TSE (SN 100456) installiert, getestet, Buchungsfähigkeit verifiziert. Tagesabschluss erfolgreich.',
    // Stress-Case für die ZE-Regel: 7:12 → 9:13 = 2h 1min = 121 min.
    // Volle Viertel: 8 (= 120 min), angefangen: 1 min < 6 → keine Pauschale.
    // Erwartet: kb_ze = "8".
    work_hours: 121 / 60,
    travel_from: 'Alling',
    travel_to: 'München',
    travel_distance_km: 18.4,
    start_time: '2026-04-27T05:12:00.000Z', // → 07:12 lokal in DE/Sommerzeit
    end_time: '2026-04-27T07:13:00.000Z',   // → 09:13 lokal
  },
  devices: [
    { name: 'Vectron POS Touch 15', serial_number: 'V15-77881', kind: 'verkauf' },
    {
      name: 'Epson TSE-Modul Type-A', serial_number: 'TSE-100456', kind: 'austausch_raus',
      pair_name: 'Epson TSE-Modul Type-A', pair_serial: 'TSE-100123',
    },
    { name: 'Epson Bondrucker TM-T88VII', serial_number: 'BD-44321', kind: 'leihe' },
  ],
  technicianSignature: BLANK_PNG,
  customerSignature: BLANK_PNG,
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
