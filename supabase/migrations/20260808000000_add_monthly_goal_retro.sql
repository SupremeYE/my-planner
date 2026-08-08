-- 월간 목표별 회고(월말 회고 슬롯) 컬럼 2개 추가.
-- 목표 페이지 개편 Stage A-1. monthly_goals 는 마이그레이션 시점 0행이라 backfill 불필요.
-- retro_status: 달성/부분/미달 3버튼. nullable(회고 미작성 = NULL). CHECK 로 허용값 제한
--   (NULL 은 CHECK 를 통과하므로 미작성 상태 허용). 프로젝트 관례(weight_records slot 등) = CHECK in.
-- retro_note: 한 줄 회고. nullable.
alter table public.monthly_goals
  add column if not exists retro_status text,
  add column if not exists retro_note   text;

alter table public.monthly_goals
  drop constraint if exists monthly_goals_retro_status_check;
alter table public.monthly_goals
  add constraint monthly_goals_retro_status_check
  check (retro_status in ('done', 'partial', 'missed'));
