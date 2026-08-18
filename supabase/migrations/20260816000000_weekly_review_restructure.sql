-- 주간 리뷰 회고 입력 구조 개편 (weekly_reviews)
-- 배경: 회고 입력을 회고하기 쉬운 5개 구조로 재구성
--   ① 기억하고 싶은 것(선택) ② KEEP ③ NOTICE ④ TRY ⑤ NEXT
-- 적용 시점 weekly_reviews 0행 → 무손실. 이행할 데이터 없음.
--
-- 컬럼 매핑:
--   ① 기억하고 싶은 것 → highlights   (신규, nullable, 선택 항목)
--   ② KEEP            → kpt_keep      (재사용)
--   ③ NOTICE          → notice        (kpt_problem 개명 — PROBLEM→NOTICE 리프레이밍을 컬럼명에도 반영)
--   ④ TRY             → kpt_try       (재사용)
--   ⑤ NEXT            → next_week     (재사용)
--   good / hard       → 제거          (새 구조 미사용 죽은 컬럼, 0행이라 무손실 정리)
--
-- 주의: monthly_reviews / review_records 의 kpt_problem 은 이번 개편 범위 밖 → 그대로 둔다.

-- ① highlights 추가 (비파괴)
alter table public.weekly_reviews add column if not exists highlights text;

-- ③ kpt_problem → notice 개명 (idempotent 가드 — 재실행 안전)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weekly_reviews' and column_name = 'kpt_problem'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weekly_reviews' and column_name = 'notice'
  ) then
    alter table public.weekly_reviews rename column kpt_problem to notice;
  end if;
end $$;

-- good / hard 제거 (0행, 새 구조 미사용)
alter table public.weekly_reviews drop column if exists good;
alter table public.weekly_reviews drop column if exists hard;
