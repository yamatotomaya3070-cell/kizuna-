-- ============================================================
-- 既存の事業所長候補ユーザーを facility_admin に昇格させる
--
-- ロジック: facility ごとに、その facility に紐づく profiles のうち
-- 「最も古いユーザー」を事業所長とみなして role = 'facility_admin' に
-- 設定する。create-facility ルートが事業所と同時に作るユーザーは
-- 常に最初のユーザーなので、これで概ね当たる。
--
-- 注意: 個別のメールアドレスで指定した方が確実な場合は、このSQLは
-- 使わずに下記の手動UPDATEを使ってください:
--   UPDATE profiles SET role = 'facility_admin'
--     FROM auth.users
--     WHERE profiles.id = auth.users.id AND auth.users.email = 'xxx@xxx';
-- ============================================================

WITH first_user_per_facility AS (
  SELECT DISTINCT ON (facility_id) id, facility_id
  FROM profiles
  WHERE facility_id IS NOT NULL
  ORDER BY facility_id, created_at ASC
)
UPDATE profiles p
SET role = 'facility_admin'
FROM first_user_per_facility f
WHERE p.id = f.id
  AND p.role = 'facility';

-- auth.users.user_metadata も同期（任意。アプリ側は profiles を見る）
-- これは Supabase Auth Admin API 経由でないと更新できないため、
-- 必要な場合は scripts/sync-user-metadata.ts などで一括更新する。
