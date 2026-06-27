-- 시간 리포트: 태그별 시간 자동 집계 기능
-- tags 테이블에 track_time 컬럼 추가 (기본 false)
-- ON으로 설정한 태그만 시간 리포트의 집계 카테고리로 사용한다.
-- 기존 태그는 모두 false 유지 (사용자가 설정에서 직접 ON으로 변경).
alter table public.tags
  add column if not exists track_time boolean not null default false;
