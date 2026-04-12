-- 캘린더 시작 요일 / 모바일 주간 표시 개수 설정 추가

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS week_starts_on smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mobile_week_days smallint DEFAULT 3;

UPDATE user_settings
SET
  week_starts_on = COALESCE(week_starts_on, 1),
  mobile_week_days = COALESCE(mobile_week_days, 3)
WHERE id = 'default';
