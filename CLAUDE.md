# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sister project — Warenwirtschaft is main, this repo is slave

**`arbeitsbericht` und `warenwirtschaft` teilen sich eine Supabase-Instanz** (`https://supabase.kassen-buch.cloud`). Warenwirtschaft ist Source-of-Truth für Kunden + Geräte; dieses Repo ist reiner Konsument und führt keine eigenen Migrationen mehr.

- **Alle DB-Migrationen** leben in `../warenwirtschaft/supabase/migrations/`. Relevant für dieses Repo:
  - `015_work_reports.sql` — `work_reports`, `work_report_devices`
  - `016_work_reports_rls.sql` — RLS für beide Tabellen
  - `017_work_report_pdfs.sql` — `work-report-pdfs` Storage bucket + `work_reports.pdf_path` / `pdf_uploaded_at`
- **`supabase/migrations/` hier ist bewusst leer.** Wenn du eine Schema-Änderung brauchst: im Warenwirtschafts-Repo die nächste Migrations-Nummer verwenden.
- **Geteilte Tabellen**, die von hier gelesen/geschrieben werden: `profiles`, `customers`, `devices`, `models`, `manufacturers`, `categories`, `work_reports`, `work_report_devices`. **Nicht** verwendet: `device_movements` (existiert in der DB seit Migration 005 nicht mehr).
- **Buchungs-Mechanik**: Der Arbeitsbericht + seine `work_report_devices`-Zeilen IST die Einsatz-Buchung. Beim Wizard-Finish wird zusätzlich `devices.status = 'im_einsatz'` batch-geupdated. Kein separater Beleg-Typ.
- **PDF-Persistenz**: Beim Finish generiert der Wizard das PDF client-seitig, lädt es lokal für den Techniker herunter **und** uploaded es zum `work-report-pdfs` Storage-Bucket (`{reportId}.pdf`). Warenwirtschaft serviert es über signed URLs.

## Commands

```bash
npm run dev       # next dev on :3000
npm run build     # production build
npm run start     # run built app
npm run lint      # eslint via next lint
npm test          # jest
```

Einzelne Tests:

```bash
npx jest lib/__tests__                          # ordner
npx jest -t 'deviceDisplayName'                 # by test name
node node_modules/typescript/bin/tsc --noEmit   # strict typecheck (no emit)
```

Tests liegen unter `lib/__tests__/`. Jest via `jest.config.ts` mit `@/*` Alias (`preset: 'ts-jest'`, `testEnvironment: 'node'`).

**Windows / Git Bash caveats** (primäres Dev-Environment):
- Falls `next` nicht im PATH ist: `node node_modules/next/dist/bin/next dev` statt `npm run dev`.
- Jest-Output wird in Git Bash manchmal stumm unterdrückt, Exit-Code unzuverlässig. Im Zweifel `tsc --noEmit` + manueller Browser-Test.

## Environment

`.env.local` mit:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Client + Server
- **Kein** `SUPABASE_SERVICE_ROLE_KEY` — dieses Projekt umgeht RLS nirgends. Falls du je einen hinzufügst: niemals in einem Client-Bundle oder `NEXT_PUBLIC_*`.

Produktion: Docker Compose hinter Traefik als `arbeitsbericht.kassen-buch.cloud`.

## Architecture

### Stack
- Next.js 14 App Router, React 18, TypeScript strict mode
- Supabase: Postgres + Auth + RLS + Storage — geteilt mit Warenwirtschaft
- `@supabase/ssr` für cookie-basierte Session-Sync
- Tailwind + shadcn/ui (Radix in `components/ui`)
- PDF: `html2canvas` + `jspdf` client-side
- Unterschriften: `react-signature-canvas`
- Toasts: `sonner`
- Path alias: `@/*` → project root

### Auth flow
`middleware.ts`: unauthenticated → `/login`; authenticated auf `/login` → `/dashboard`. `app/(protected)/layout.tsx` lädt `profiles`-Row und rendert Navbar.

Supabase-Clients:
- `lib/supabase/server.ts` → Server Components / Actions / Route Handlers
- `lib/supabase/client.ts` → `'use client'` Komponenten

Kein Service-Role-Client. Alle Writes über RLS.

### 5-Schritte-Wizard
`components/arbeitsberichte/wizard.tsx`:

1. **Kunde** (`step-kunde.tsx`) — Auswahl oder Neu-Anlage. Customer-Felder: `name, address, phone, email` (Warenwirtschafts-Schema, kein `city`, kein `updated_at`). Beim ersten Save entsteht der `work_reports`-Row mit `status='entwurf'`.
2. **Tätigkeit** — `description`.
3. **Geräte** (`step-geraete.tsx`) — Multi-Select aus `devices WHERE status='lager'`. Select joined über `model → manufacturer / category`. Display-Name via `deviceDisplayName(model)` in `lib/utils.ts`. Beim Save wird `work_report_devices` replaced (delete + insert).
4. **Aufwand** — `work_hours`, `travel_from/_to`, `start_time/end_time`.
5. **Unterschriften** — Techniker + Kunde via `react-signature-canvas`. `handleFinish`:
   - `work_reports` → `status='abgeschlossen'`, Signaturen, `completed_at`
   - `devices.status='im_einsatz'` batch-update auf alle selektierten Geräte
   - PDF rendern → lokaler Download → Upload zu `work-report-pdfs/{reportId}.pdf` → `pdf_path` + `pdf_uploaded_at` persistieren
   - Redirect zu `/arbeitsberichte`

Die Multi-Call-Kette in `handleFinish` ist **nicht transaktional**. Bei Erweiterungen lieber RPC als weitere einzelne Calls.

### Device display helper
`lib/utils.ts` exportiert `deviceDisplayName(model)` — kombiniert `manufacturer.name + modellname + variante`. Nutze das überall für die Gerät-Anzeige, statt `devices.name` zu erwarten (existiert nicht).

### Server Components by default, client components for interactivity
Seiten unter `app/(protected)/` sind async Server Components mit `createClient()` aus `lib/supabase/server.ts`. Nur Wizard / Steps / Dialoge sind `'use client'`.

## Conventions

- **Sprache:** UI-Strings, Toasts, Labels auf Deutsch. Code, Identifier, Commits auf Englisch.
- **Schema-Änderungen gehören ins Warenwirtschafts-Repo.** Dieses Repo ist Konsument, nicht Producer. `supabase/migrations/` hier bleibt leer.
- **TypeScript:** `strict: true`. `any`-Casts nur mit Kommentar.
- **PDF-Upload ist load-bearing.** Ohne `pdf_path` kann Warenwirtschaft den Bericht nicht servieren. Upload-Failure wird als Toast angezeigt, der lokale Download passiert trotzdem — aber der Bericht bleibt in Warenwirtschaft PDF-los, bis manuell nachgezogen.

## Git workflow

- **Conventional Commits mit Scope**: `feat(wizard): …`, `fix(pdf): …`, `refactor(types): …`.
- **Nie direkt auf `main` pushen.** Feature-Branch + PR.
- **Kein `--no-verify`, kein `--force` auf shared branches.**

## No-Gos (häufige Fallen)

- **Keine Schema-Änderung hier.** Immer in `../warenwirtschaft/supabase/migrations/` mit nächster Nummer. Die Cloud-DB ist geteilt — doppelte Migrations-Nummer = Chaos.
- **`devices.name` / `devices.category_id` existieren nicht.** Namen und Kategorie kommen über `model → manufacturer / category`. Nutze `deviceDisplayName(model)`.
- **Kein `device_movements`-Insert.** Tabelle existiert nicht mehr. `work_report_devices` + `devices.status='im_einsatz'` sind die Buchung.
- **`customers` ist Warenwirtschafts-Territorium.** Felder: `id, name, email, phone, address, notes, created_at`. Kein `city`, kein `updated_at`. Wenn Techniker neue Kunden anlegt: gerne — Admin pflegt später in Warenwirtschaft nach.
- **RLS-Helfer `get_my_role()` / `update_updated_at()` kommen aus Warenwirtschaft** (Migrationen 001 / 002). Nicht hier neu anlegen.
- **PDF-Bucket-Pfad-Konvention**: `{work_report_id}.pdf`. Nicht ändern ohne Warenwirtschafts-Detail-View mitzuziehen.
- **Keine Multi-Row-Transaktionen zerschlagen.** Wenn du mehr Schritte in `handleFinish` brauchst: RPC schreiben statt Calls anhängen.
