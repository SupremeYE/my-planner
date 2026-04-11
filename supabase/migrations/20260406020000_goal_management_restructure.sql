-- 월간 목표 ↔ 연간 목표 연결
ALTER TABLE monthly_goals
  ADD COLUMN IF NOT EXISTS annual_goal_id text;

-- 해당 월(yyyy) 연도에 맞는 연간 목표 중 가장 먼저 생성된 1건에 연결
UPDATE monthly_goals mg
SET annual_goal_id = (
  SELECT ag.id
  FROM annual_goals ag
  WHERE ag.year = (substring(mg.month from 1 for 4))::integer
  ORDER BY ag.created_at ASC
  LIMIT 1
)
WHERE mg.annual_goal_id IS NULL;

-- 연도별 연간 정체성·가치 (JSONB). 키는 연도 문자열 "2026"
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS annual_profiles jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 기존 단일 컬럼 → 올해 키로 이관 (비어 있을 때만)
UPDATE user_settings
SET annual_profiles = jsonb_build_object(
  extract(year from now())::text,
  jsonb_build_object(
    'identity', coalesce(annual_identity, ''),
    'values', coalesce(
      (SELECT jsonb_agg(elem::text) FROM unnest(coalesce(annual_values, array[]::text[])) AS elem),
      '[]'::jsonb
    )
  )
)
WHERE annual_profiles = '{}'::jsonb
  AND (
    (annual_identity IS NOT NULL AND btrim(annual_identity) <> '')
    OR (annual_values IS NOT NULL AND cardinality(annual_values) > 0)
  );
