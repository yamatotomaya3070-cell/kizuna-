-- ============================================================
-- profiles.role を3層に固定する CHECK 制約
--   admin          : 本部管理者（SaaS提供側）
--   facility_admin : 事業所長（利用側・自施設管理）
--   facility       : 施設スタッフ（利用側・現場職員）
-- ============================================================

-- 既存の不正な role 値を矯正（念のため）
UPDATE profiles SET role = 'facility' WHERE role NOT IN ('admin', 'facility_admin', 'facility');

-- 既に同名制約があったら一旦落とす
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'facility_admin', 'facility'));
