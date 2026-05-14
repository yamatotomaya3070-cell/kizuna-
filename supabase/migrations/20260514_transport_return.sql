-- 送迎を「行」「帰」に分割
-- 既存 transport 列を「行」として扱い、新たに transport_return（帰）を追加
ALTER TABLE daily_attendance
  ADD COLUMN IF NOT EXISTS transport_return TEXT DEFAULT '○';

-- 既存データのバックフィル：transport が △ の場合は便宜的に 行=○ 帰=● とし、
-- それ以外は transport をそのままコピー
UPDATE daily_attendance
SET transport_return = CASE
  WHEN transport = '△' THEN '●'
  ELSE transport
END
WHERE transport_return IS NULL OR transport_return = '○';

-- transport が △ の行は 行=○ に正規化（片道のうち「行のみ」と仮定）
UPDATE daily_attendance
SET transport = '○'
WHERE transport = '△';
