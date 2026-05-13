-- 利用者マスタ項目を追加
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_status_check;

ALTER TABLE clients
  ADD CONSTRAINT clients_status_check
  CHECK (status IN ('active', 'paused', 'left'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'Users can update own facility clients'
  ) THEN
    CREATE POLICY "Users can update own facility clients"
      ON clients FOR UPDATE
      USING (facility_id IN (
        SELECT facility_id FROM profiles WHERE id = auth.uid()
      ))
      WITH CHECK (facility_id IN (
        SELECT facility_id FROM profiles WHERE id = auth.uid()
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_facility_status_name
  ON clients(facility_id, status, name);

-- 既存の出欠データだけに存在する利用者名を利用者マスタへ移行
INSERT INTO clients (facility_id, name, status, notes)
SELECT DISTINCT da.facility_id, da.client_name, 'active', '出欠データから移行'
FROM daily_attendance da
WHERE da.facility_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM clients c
    WHERE c.facility_id = da.facility_id
      AND c.name = da.client_name
  );
