-- =====================================================================
-- 통합 일기 Stage 3 · "이날의 기억"(5년 일기) 조회 RPC
-- ---------------------------------------------------------------------
-- 기준 날짜의 월/일과 같고, 연도는 지정 범위(올해-1 ~ 올해-5) 안인
-- diary_entries 를 모두(type 무관) 반환한다.
-- extract(month/day) 필터 → diary_entries_user_monthday_idx 사용.
-- 2월 29일은 윤년에만 매칭되어 평년 과거 연도는 자연스럽게 빈 상태가 된다.
-- security invoker(기본) + diary_entries RLS → 본인 기록만 조회된다.
-- =====================================================================
create or replace function public.diary_on_this_day(
  p_month     int,
  p_day       int,
  p_from_year int,
  p_to_year   int
)
returns setof public.diary_entries
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.diary_entries
  where extract(month from entry_date) = p_month
    and extract(day   from entry_date) = p_day
    and extract(year  from entry_date) between p_from_year and p_to_year
  order by entry_date desc;
$$;
