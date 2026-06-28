-- 리뷰 & 기록 페이지 개선 — Stage 1 (DB 마이그레이션, 비파괴)
-- 1) happy_moments 신규 테이블 (행복 기록 독립 분리)
-- 2) weekly_reviews  KPT 컬럼 3종 추가
-- 3) monthly_reviews 신규 11컬럼 추가
-- 4) user_settings   supabase_realtime publication 등록(누락분 보완)
--
-- 컨벤션: 리뷰 계열 형제 테이블(review_records/weekly_reviews/monthly_reviews)과 동일하게
--   - id 는 클라이언트 생성 호환을 위해 default 제공(happy_moments 는 uuid default gen_random_uuid())
--   - user_id 컬럼 없음 → 단일 사용자 owner uid 하드코딩 RLS 로만 보호
--   - 모든 ADD COLUMN 은 IF NOT EXISTS (비파괴), 기존 컬럼/데이터 DROP 금지

-- ── 1) happy_moments — 행복 기록 ───────────────────────────────────────────────
create table if not exists public.happy_moments (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  date text,                       -- 'yyyy-MM-dd'
  happened_at timestamptz,         -- nullable (과거 백필 건은 시각 없음)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists happy_moments_date_idx on public.happy_moments (date);
create index if not exists happy_moments_created_idx on public.happy_moments (created_at desc);

-- RLS: 단일 사용자 owner uid 하드코딩 (review_records / user_settings 동일 구문)
alter table public.happy_moments enable row level security;
drop policy if exists "owner only" on public.happy_moments;
create policy "owner only" on public.happy_moments
  for all to authenticated
  using (auth.uid() = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'::uuid)
  with check (auth.uid() = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'::uuid);

-- ── 2) weekly_reviews — KPT 컬럼 ──────────────────────────────────────────────
alter table public.weekly_reviews add column if not exists kpt_keep text;
alter table public.weekly_reviews add column if not exists kpt_problem text;
alter table public.weekly_reviews add column if not exists kpt_try text;

-- ── 3) monthly_reviews — 신규 11컬럼 ──────────────────────────────────────────
alter table public.monthly_reviews add column if not exists highlight text;
alter table public.monthly_reviews add column if not exists did_well text;
alter table public.monthly_reviews add column if not exists regret text;
-- next_focus 는 기존 컬럼이 이미 존재 → IF NOT EXISTS 라 안전한 no-op(보존, 재생성 안 함)
alter table public.monthly_reviews add column if not exists next_focus text;
alter table public.monthly_reviews add column if not exists kpt_keep text;
alter table public.monthly_reviews add column if not exists kpt_problem text;
alter table public.monthly_reviews add column if not exists kpt_try text;
alter table public.monthly_reviews add column if not exists best_video text;
alter table public.monthly_reviews add column if not exists best_music text;
alter table public.monthly_reviews add column if not exists best_book text;
alter table public.monthly_reviews add column if not exists best_place text;

-- ── 4) Realtime publication 등록 (happy_moments + user_settings, 중복 가드) ────
do $$
declare
  t text;
  tbls text[] := array['happy_moments','user_settings'];
begin
  foreach t in array tbls loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
