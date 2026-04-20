-- supabase/migrations/003_work_reports.sql

CREATE TYPE work_report_status AS ENUM ('entwurf', 'abgeschlossen');

-- Kundenstamm
CREATE TABLE customers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  address     text,
  city        text,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fortlaufende Berichtsnummer (AB-YYYY-NNNN)
CREATE OR REPLACE FUNCTION generate_report_number()
RETURNS text AS $$
DECLARE
  year_str text := to_char(now(), 'YYYY');
  seq_num  int;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM work_reports
  WHERE report_number LIKE 'AB-' || year_str || '-%';
  RETURN 'AB-' || year_str || '-' || LPAD(seq_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Arbeitsberichte
CREATE TABLE work_reports (
  id                   uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number        text                UNIQUE,
  customer_id          uuid                NOT NULL REFERENCES customers(id),
  technician_id        uuid                NOT NULL REFERENCES profiles(id),
  description          text,
  work_hours           numeric(5,2),
  travel_from          text,
  travel_to            text,
  start_time           timestamptz         NOT NULL DEFAULT now(),
  end_time             timestamptz,
  status               work_report_status  NOT NULL DEFAULT 'entwurf',
  technician_signature  text,
  customer_signature   text,
  completed_at         timestamptz,
  created_at           timestamptz         NOT NULL DEFAULT now(),
  updated_at           timestamptz         NOT NULL DEFAULT now()
);

CREATE TRIGGER work_reports_updated_at
  BEFORE UPDATE ON work_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION set_report_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.report_number IS NULL THEN
    NEW.report_number := generate_report_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_reports_set_number
  BEFORE INSERT ON work_reports
  FOR EACH ROW EXECUTE FUNCTION set_report_number();

-- Geräte-Zuordnung (Junction)
CREATE TABLE work_report_devices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_report_id uuid        NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  device_id      uuid        NOT NULL REFERENCES devices(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_report_id, device_id)
);