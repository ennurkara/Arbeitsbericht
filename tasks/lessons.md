# Lessons

## 2026-04-24 — Cross-Repo DB-Migrations bei shared Supabase

**Kontext:** `arbeitsbericht` und `warenwirtschaft` teilen sich eine Supabase-Instanz. Beide Repos hatten unabhängig `003_*.sql` und `004_*.sql` angelegt — Arbeitsbericht wurde dadurch auf einem veralteten `devices`-Schema entwickelt (`devices.name`, `categories`-Direktjoin, `device_movements`-Insert). Der Code war gegen den realen DB-Zustand kaputt.

**Regel:** Bei shared-DB zwischen Repos gibt es **genau eine** fortlaufende Migrations-Nummerierung und **ein** Repo, das sie führt. Alle anderen Repos sind Konsumenten und legen **keine eigenen Migrations-Files** mehr an. Ihr `supabase/migrations/` bleibt leer (oder fehlt).

**How to apply:**
- Vor jeder Schema-Change-Idee: prüfen, welches Repo die Migration besitzt. Bei `arbeitsbericht` ⇒ immer in `../warenwirtschaft/supabase/migrations/` mit nächster Nummer.
- CLAUDE.md im Slave-Repo oben als erstes dokumentieren: „This repo is slave, DB owned by X".
- Kein `CREATE TABLE customers` / `CREATE TYPE user_role` im Slave — wenn es das schon im Main gibt, referenzieren, nicht neu anlegen.
- Slave-TypeScript-Types am Main-Schema ausrichten, nicht am Wunsch-Schema: `Customer` hier hatte `city`, die Cloud-DB hat es nicht → TypeScript-Typen waren bequem, aber nicht wahr.
