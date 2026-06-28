-- 하온 머니 — Plan-Stage 2 (회고: 주간 + 월말)
-- 회고 1행 = (기간, 주차) 또는 (기간, 월말). 대부분 자동 계산이라 저장은 최소(소감/조정만 사용자 입력).
--   · type='weekly'  : week_index = 몇 주차(1-based). 주간 회고 — 한 기간에 주차별 1행.
--   · type='monthly' : week_index = null. 월말 종합 회고 — 한 기간에 1행.
--   · total_spent     : 회고 시점 지출 집계 스냅샷(나중 비교/표시용. 라이브 값은 런타임 재계산).
--   · note            : 한 줄 소감(선택, nullable). next_adjustment: 다음 기간 조정 제안(선택 jsonb).
-- 컨벤션은 20260628040000_money_plans.sql 과 동일(uid 하드코딩 RLS · realtime · 인덱스). upsert 는 id 충돌 기준.

create table if not exists public.money_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,                       -- 'weekly' | 'monthly'
  period_start date not null,               -- 기간 식별 키(getMoneyPeriod().start)
  period_end date not null,
  week_index int,                           -- weekly: 주차(1-based) / monthly: null
  total_spent bigint not null default 0,    -- 회고 시점 지출 집계 스냅샷
  note text,                                -- 한 줄 소감(선택)
  next_adjustment jsonb,                    -- 다음 기간 조정 제안(선택)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 한 기간에 주차별 1행(weekly) / 한 기간에 1행(monthly). 재회고는 upsert(id 기준).
create unique index if not exists money_reviews_weekly_uidx
  on public.money_reviews (user_id, period_start, week_index) where type = 'weekly';
create unique index if not exists money_reviews_monthly_uidx
  on public.money_reviews (user_id, period_start) where type = 'monthly';
create index if not exists money_reviews_user_period_idx
  on public.money_reviews (user_id, period_start);

-- RLS: 단일 사용자 owner uid 하드코딩 FOR ALL (기존 머니 테이블과 동일).
do $$
declare uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
begin
  execute 'alter table public.money_reviews enable row level security';
  execute 'drop policy if exists "owner only" on public.money_reviews';
  execute format(
    'create policy "owner only" on public.money_reviews for all to authenticated using (auth.uid() = %L) with check (auth.uid() = %L)',
    uid, uid);
end $$;

-- Realtime publication 등록(중복 skip) — PC↔모바일 즉시 반영.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'money_reviews'
  ) then
    execute 'alter publication supabase_realtime add table public.money_reviews';
  end if;
end $$;
