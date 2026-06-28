-- 하온 머니 — Plan-Stage 1 (월초 "이번 달 계획하기")
-- 월간 계획 1행/기간: 예상 수입 → 고정 지출(고정비+대출 월상환) 차감 → 가용 금액 → 선저축 분배(저축/투자/생활비).
--   · period_start 로 기간을 식별(급여일/달력 기준 모두 getMoneyPeriod().start 와 동일 문자열).
--   · (user_id, period_start) 유니크 — 한 기간에 계획 1개. 재계획 시 upsert.
--   · fixed_cost_total/available_amount 는 "계획 수립 시점 스냅샷"(회고 단계 비교 기준). 라이브 값은 런타임 재계산.
-- 컨벤션은 20260627000000_create_money_tables.sql 과 동일(uid 하드코딩 RLS · realtime · 인덱스).

create table if not exists public.money_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_start date not null,           -- 기간 식별 키(getMoneyPeriod().start)
  period_end date not null,
  expected_income bigint not null default 0,    -- 이번 기간 예상 수입(월급+부수입 등)
  fixed_cost_total bigint not null default 0,   -- 고정 지출 합(월환산 고정비 + 대출 월상환) 스냅샷
  available_amount bigint not null default 0,   -- 예상수입 − 고정지출 = 가용 금액 스냅샷
  planned_savings bigint not null default 0,    -- 선저축 배분
  planned_investment bigint not null default 0, -- 투자 배분
  planned_living bigint not null default 0,     -- 생활비(변동 지출) 배분
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 한 기간에 계획 1행(재계획은 upsert).
create unique index if not exists money_plans_user_period_uidx
  on public.money_plans (user_id, period_start);
create index if not exists money_plans_user_created_idx
  on public.money_plans (user_id, created_at desc);

-- RLS: 단일 사용자 owner uid 하드코딩 FOR ALL (기존 머니 테이블과 동일).
do $$
declare uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
begin
  execute 'alter table public.money_plans enable row level security';
  execute 'drop policy if exists "owner only" on public.money_plans';
  execute format(
    'create policy "owner only" on public.money_plans for all to authenticated using (auth.uid() = %L) with check (auth.uid() = %L)',
    uid, uid);
end $$;

-- Realtime publication 등록(중복 skip) — PC↔모바일 즉시 반영.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'money_plans'
  ) then
    execute 'alter publication supabase_realtime add table public.money_plans';
  end if;
end $$;
