-- ============================================================
-- staff_shifts: 日別の出勤職員シフト
-- diaries.recorded_date: 日報の対象日（記録対象の日付）
-- ============================================================

-- ── staff_shifts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_shifts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id  UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  shift_date   DATE NOT NULL,
  staff_id     UUID REFERENCES staff(id) ON DELETE CASCADE,
  staff_name   TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'work',
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(facility_id, shift_date, staff_id)
);

ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own facility shifts"
  ON staff_shifts FOR SELECT
  USING (facility_id IN (
    SELECT facility_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own facility shifts"
  ON staff_shifts FOR INSERT
  WITH CHECK (facility_id IN (
    SELECT facility_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own facility shifts"
  ON staff_shifts FOR UPDATE
  USING (facility_id IN (
    SELECT facility_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own facility shifts"
  ON staff_shifts FOR DELETE
  USING (facility_id IN (
    SELECT facility_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_staff_shifts_facility_date
  ON staff_shifts(facility_id, shift_date);

-- ── diaries.recorded_date ─────────────────────────────────
ALTER TABLE diaries ADD COLUMN IF NOT EXISTS recorded_date DATE;

UPDATE diaries
SET recorded_date = (recorded_at AT TIME ZONE 'Asia/Tokyo')::DATE
WHERE recorded_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_diaries_facility_recorded_date
  ON diaries(facility_id, recorded_date DESC);
