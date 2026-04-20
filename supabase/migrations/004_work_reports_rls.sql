-- supabase/migrations/004_work_reports_rls.sql

ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_devices ENABLE ROW LEVEL SECURITY;

-- customers: alle authentifizierten Nutzer lesen; mitarbeiter + admin schreiben
CREATE POLICY "customers_select" ON customers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));
CREATE POLICY "customers_update" ON customers
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

-- work_reports: Techniker sieht eigene; admin sieht alle; viewer read-only
CREATE POLICY "reports_select_own" ON work_reports
  FOR SELECT TO authenticated
  USING (technician_id = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "reports_insert" ON work_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND technician_id = auth.uid()
  );
CREATE POLICY "reports_update_own" ON work_reports
  FOR UPDATE TO authenticated
  USING (
    (technician_id = auth.uid() OR get_my_role() = 'admin')
    AND get_my_role() IN ('admin', 'mitarbeiter')
  );

-- work_report_devices: folgt Rechten des zugehörigen work_report
CREATE POLICY "report_devices_select" ON work_report_devices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND (wr.technician_id = auth.uid() OR get_my_role() = 'admin')
    )
  );
CREATE POLICY "report_devices_insert" ON work_report_devices
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id AND wr.technician_id = auth.uid()
    )
  );
CREATE POLICY "report_devices_delete" ON work_report_devices
  FOR DELETE TO authenticated
  USING (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id AND wr.technician_id = auth.uid()
    )
  );