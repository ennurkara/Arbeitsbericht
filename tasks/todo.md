# Arbeitsbericht ↔ Warenwirtschaft Integration

**Ziel:** Techniker erstellt Arbeitsbericht (Arbeitsbericht-App), wählt Kunden + Geräte aus der **shared** Warenwirtschafts-DB. Bei „PDF erstellen bestätigen" wird Bericht + PDF persistiert. In Warenwirtschaft erscheint ein neuer NAV-Bar-Eintrag **„Arbeitsberichte"** (Liste + Detail-View + PDF-Download). Erstellung läuft weiterhin nur in der Arbeitsbericht-App.

**Architektur-Entscheidung:** Option A — der Arbeitsbericht + `work_report_devices` IST die Buchung. Kein neuer Beleg-Typ. Keine `device_movements`-Zeile. `devices.status='im_einsatz'` + `work_report_devices` reichen.

**PDF-Pipeline:** Client generiert PDF (jspdf/html2canvas wie heute), beim Finish wird das PDF zu Supabase Storage (`work-report-pdfs` bucket) hochgeladen und `work_reports.pdf_path` gespeichert. Techniker bekommt gleichzeitig lokalen Download. Warenwirtschaft serviert nur signed URLs — kein jspdf-Duplikat.

---

## Phase 1 — DB-Schema-Alignment

Migrationen landen im **Warenwirtschafts-Repo** (`C:\Users\ekara\dev\warenwirtschaft\supabase\migrations\`), nicht hier — dort ist die fortlaufende Nummer gepflegt und die DB-Wahrheit dokumentiert. Dieses Repo behält seine `003/004` nur als „Altlast-Marker" und bekommt darüber im Kopf einen Hinweis.

- [x] **W-1**: `warenwirtschaft/supabase/migrations/015_work_reports.sql` angelegt (`work_reports` + `work_report_devices`, ohne `customers`-Duplikat).
- [x] **W-2**: `warenwirtschaft/supabase/migrations/016_work_reports_rls.sql` angelegt (RLS für beide Tabellen, inkl. viewer-SELECT).
- [x] **W-3**: `warenwirtschaft/supabase/migrations/017_work_report_pdfs.sql` angelegt (bucket `work-report-pdfs` + Storage-Policies + `pdf_path`/`pdf_uploaded_at` auf `work_reports`).
- [x] **W-4**: Alte Arbeitsbericht-Migrationen `003_work_reports.sql` + `004_work_reports_rls.sql` gelöscht.

## Phase 2 — Arbeitsbericht-Code fixen

- [x] **AB-1**: `lib/types.ts` — Schema an Warenwirtschaft angepasst (Customer ohne city/updated_at, Device mit Model-Join, DeviceStatus erweitert, WorkReport mit pdf_path/pdf_uploaded_at).
- [x] **AB-2**: `step-kunde.tsx` — city entfernt, email hinzugefügt, Listing nach address.
- [x] **AB-3**: `step-geraete.tsx` — Model-Join, Display via `deviceDisplayName()` Helper in `lib/utils.ts`.
- [x] **AB-4**: `pdf-template.tsx` — Kunden-Felder angepasst (kein city, dafür email).
- [x] **AB-5**: `wizard.tsx` — `device_movements`-Insert gestrichen, Batch-Update `devices.status`, PDF-Upload zu `work-report-pdfs/{reportId}.pdf` mit `pdf_path`/`pdf_uploaded_at`-Persistenz.
- [x] **AB-6**: `pdf-export.ts` — gibt nach `save()` den Blob zurück.
- [x] **AB-7**: `app/(protected)/arbeitsberichte/page.tsx` — client-Rollenfilter raus, RLS filtert.
- [x] **AB-8**: `app/(protected)/arbeitsberichte/[id]/page.tsx` — Model-Join, city raus, viewer als canView.

Typecheck: `tsc --noEmit` grün.

## Phase 3 — Warenwirtschaft-UI

- [x] **WW-1**: Liste unter `app/(protected)/arbeitsberichte/page.tsx` — report_number, Kunde, Techniker, Datum, Status, PDF-Marker. RLS filtert serverseitig.
- [x] **WW-2**: Detail unter `.../[id]/page.tsx` — strikt read-only. PDF-Download via `createSignedUrl` (10 min TTL). Signaturen als base64 img rendered.
- [x] **WW-3**: Sidebar + MobileNav bekommen `/arbeitsberichte` (alle authenticated). Kein „Neu"-Button.
- [ ] **WW-4**: _skipped — Dashboard-Widget optional, nicht im Scope dieser Runde._

## Phase 4 — Doku / Lessons

- [x] **D-1**: Arbeitsbericht-CLAUDE.md komplett neu geschrieben (slave-role, storage flow, no device_movements, migration-frozen).
- [x] **D-2**: Warenwirtschaft-CLAUDE.md bekommt „Arbeitsberichte (sister-app)"-Sektion vor No-Gos.
- [x] **D-3**: `tasks/lessons.md` angelegt — Cross-Repo-Migrations-Regel.

---

## Entscheidungen (bestätigt)

1. **NAV-Sichtbarkeit**: alle authenticated Rollen (admin / mitarbeiter / viewer).
2. **Edit in Warenwirtschaft**: strikt read-only. Korrekturen = neuer Bericht mit Bezug auf alten.
3. **PDF-Aufbewahrung**: forever, kein TTL.
4. **Customer-Neuanlage im Wizard**: bleibt erlaubt. Techniker kann Kunde anlegen, Admin pflegt nach.
5. **Alte Migrationen**: `supabase/migrations/003_work_reports.sql` + `004_work_reports_rls.sql` löschen (nicht deprecaten).

## Review (2026-04-24)

**Status:** Code-Seite komplett — beide Repos kompilieren ohne neue TS-Fehler. DB-Migrationen liegen als SQL-Files bereit, aber wurden **noch nicht gegen die Cloud-DB angewendet**. Bevor das Feature live nutzbar ist:

### Vor dem nächsten `docker compose up --build` auszuführen

Reihenfolge im Supabase SQL Editor (gegen `https://supabase.kassen-buch.cloud`):

1. `warenwirtschaft/supabase/migrations/015_work_reports.sql`
2. `warenwirtschaft/supabase/migrations/016_work_reports_rls.sql`
3. `warenwirtschaft/supabase/migrations/017_work_report_pdfs.sql`

Alle drei sind idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`). Bei Re-Run passiert nichts.

### Was in den Repos geändert wurde

**Warenwirtschaft:**
- Neue Migrationen 015 / 016 / 017 in `supabase/migrations/`
- `lib/types.ts`: `DeviceStatus` um `im_einsatz` erweitert, `WorkReport` + `WorkReportStatus` hinzugefügt
- `lib/utils.ts`: `formatDateTime`, `deviceDisplayName`, `im_einsatz`-Label
- Neue Routen `app/(protected)/arbeitsberichte/page.tsx` + `[id]/page.tsx`
- `components/layout/sidebar.tsx` + `mobile-nav.tsx`: Link „Arbeitsberichte"
- `CLAUDE.md`: neue Sister-App-Sektion

**Arbeitsbericht:**
- `supabase/migrations/` komplett geleert (003/004 gelöscht, Migrationen sind jetzt Warenwirtschafts-Domäne)
- `lib/types.ts`: an echtes Schema angepasst (Customer ohne city, Device mit model-join, DeviceStatus erweitert, WorkReport um pdf_path/pdf_uploaded_at)
- `lib/utils.ts`: `deviceDisplayName`-Helper
- `components/arbeitsberichte/step-kunde.tsx`: city→email
- `components/arbeitsberichte/step-geraete.tsx`: model-join statt `devices.name` / `categories`
- `components/arbeitsberichte/pdf-template.tsx`: customer ohne city, mit email
- `components/arbeitsberichte/pdf-export.ts`: liefert Blob zurück
- `components/arbeitsberichte/wizard.tsx`: `device_movements`-Insert entfernt, Status-Batch-Update, PDF-Upload zu `work-report-pdfs` bucket, Persistierung von `pdf_path` / `pdf_uploaded_at`
- `app/(protected)/arbeitsberichte/page.tsx`: client-Rollenfilter raus (RLS)
- `app/(protected)/arbeitsberichte/[id]/page.tsx`: model-join, city raus, viewer als canView
- `CLAUDE.md`: komplett neu (slave-role)
- `tasks/lessons.md`: neue Lesson zum Thema Cross-Repo-Migrations

### Offene Punkte fürs nächste Mal

- **Manuelle Verifikation im Browser** steht noch aus — der Code ist getippt sauber, aber der E2E-Flow (Wizard → Upload → Warenwirtschaft-Listing + Download) muss einmal manuell durchgespielt werden.
- **Alte `work_reports`-Testdaten** (falls vorhanden) können nach Migration 015 leichte Probleme machen, wenn die alte arbeitsbericht-`customers`-Tabelle doch irgendwann mal gelaufen ist. Vorab per SQL checken: `SELECT COUNT(*) FROM work_reports;` und Schema-Diff.
- **Dashboard-Widget „letzte 5 Berichte"** in Warenwirtschaft — bewusst nicht gebaut, bei Bedarf nachziehen.
- **WhatsApp-/E-Mail-Versand** des PDFs an den Kunden — nicht im Scope, wäre ein Folge-Feature.

