-- Stage 1: 수면 목표 시간 설정값
-- user_settings 테이블에 sleep_goal_minutes 컬럼 추가 (분 단위)
-- 미설정(NULL) 시 앱에서 기본 420분(7시간)으로 계산.
alter table public.user_settings
  add column if not exists sleep_goal_minutes int4 null;
