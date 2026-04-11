-- 설정 페이지 신설에 따른 user_settings 테이블 컬럼 추가
-- 기존 day_start_hour, day_end_hour에 앱 기능 설정 컬럼 추가

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS show_quarterly_goals  boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_weekly_kpt       boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_weekly_happiness boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_monthly_kpt      boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_habit_heatmap    boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS habit_alarm_default   text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS global_affirmation    text     DEFAULT NULL;
