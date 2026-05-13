-- ============================================================
-- support_plans  : 個別支援計画書（バージョン管理 + 構造化保存）
-- monitorings    : 6ヶ月モニタリング評価（support_plan_id で計画と紐付け）
-- diaries        : ai_comment / final_comment / selected_eval_items を comments JSONB に格納する運用なので
--                   追加カラムは不要。recorded_date は別 migration で追加済み
-- ============================================================

-- ── support_plans ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_plans (
  id                            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id                   UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  client_id                     UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name                   TEXT NOT NULL,
  plan_version                  INTEGER NOT NULL DEFAULT 1,
  plan_start_date               DATE NOT NULL,
  plan_end_date                 DATE NOT NULL,
  -- 計画ヘッダ
  author_name                   TEXT,
  service_manager_name          TEXT,
  created_date                  DATE,
  meeting_date                  DATE,
  consent_date                  DATE,
  issued_date                   DATE,
  staff_in_charge               TEXT,
  -- 方針・目標
  assessment_summary            TEXT,
  user_needs                    TEXT,
  family_needs                  TEXT,
  attainment_goal               TEXT,
  overall_support_policy        TEXT,
  long_term_goal                TEXT,
  short_term_goals              TEXT,
  -- 3つの目標項目（Excelに合わせて 1〜3 を構造化保存）
  -- それぞれ {priority, specific_goal, user_role, support_content, support_duration, consideration_points}
  goals_json                    JSONB NOT NULL DEFAULT '[]',
  -- AI生成の生テキスト
  raw_generated_text            TEXT,
  -- 元テンプレート参照（出力時のセルマッピングをトラッキング）
  original_excel_template_name  TEXT DEFAULT 'support_plan_monitoring_template.xlsx',
  original_sheet_name           TEXT DEFAULT '支援計画',
  cell_mapping_json             JSONB,
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE support_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own facility support_plans"
  ON support_plans FOR SELECT
  USING (facility_id IN (SELECT facility_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own facility support_plans"
  ON support_plans FOR INSERT
  WITH CHECK (facility_id IN (SELECT facility_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own facility support_plans"
  ON support_plans FOR UPDATE
  USING (facility_id IN (SELECT facility_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete own facility support_plans"
  ON support_plans FOR DELETE
  USING (facility_id IN (SELECT facility_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_support_plans_facility_client_period
  ON support_plans(facility_id, client_id, plan_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_support_plans_facility_client_name
  ON support_plans(facility_id, client_name);


-- ── monitorings ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitorings (
  id                            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id                   UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  client_id                     UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name                   TEXT NOT NULL,
  support_plan_id               UUID REFERENCES support_plans(id) ON DELETE SET NULL,
  monitoring_period_start       DATE NOT NULL,
  monitoring_period_end         DATE NOT NULL,
  evaluation_date               DATE DEFAULT current_date,
  -- 目標ごとの評価（{goal_index, evaluation: A/B/C, remaining_issue, evidence}）の配列
  goal_evaluations              JSONB NOT NULL DEFAULT '[]',
  achievement_summary           TEXT,
  remaining_issues              TEXT,
  next_support_policy           TEXT,
  next_goal_suggestions         TEXT,
  raw_generated_text            TEXT,
  -- 元テンプレート参照
  original_excel_template_name  TEXT DEFAULT 'support_plan_monitoring_template.xlsx',
  original_sheet_name           TEXT DEFAULT 'モニタリング',
  cell_mapping_json             JSONB,
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE monitorings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own facility monitorings"
  ON monitorings FOR SELECT
  USING (facility_id IN (SELECT facility_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own facility monitorings"
  ON monitorings FOR INSERT
  WITH CHECK (facility_id IN (SELECT facility_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own facility monitorings"
  ON monitorings FOR UPDATE
  USING (facility_id IN (SELECT facility_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete own facility monitorings"
  ON monitorings FOR DELETE
  USING (facility_id IN (SELECT facility_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_monitorings_facility_client_period
  ON monitorings(facility_id, client_id, monitoring_period_start DESC);
CREATE INDEX IF NOT EXISTS idx_monitorings_support_plan
  ON monitorings(support_plan_id);
