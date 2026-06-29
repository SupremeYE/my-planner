-- 하온 머니 — Plan-Stage 1.5-A (계획하기 통장 쪼개기 + 생활비 한도)
-- 월초 계획 ④ 분배를 "고정 3칸(저축/투자/생활비)"에서 "자유 분배 항목"으로 확장.
--   · 항목마다 이름 + 금액 + (선택) 연동 통장(account_id) + 생활비(한도) 여부(is_living).
--   · 생활비(is_living=true) 항목의 금액 = 이번 달 "생활비 한도". money_plans.living_limit 에도 스냅샷.
--   · 통장 연결은 선택 — 연결 시 "이 통장에 N원 보내기" 안내 생성(통장 쪼개기).
-- 컨벤션은 20260628040000_money_plans.sql 과 동일(uid 하드코딩 RLS · realtime · 인덱스). plan 삭제 시 cascade.

-- money_plans 에 생활비 한도 컬럼 추가(기존 planned_living 과 함께 보존 — 한도 단일 출처).
alter table public.money_plans add column if not exists living_limit bigint not null default 0;

create table if not exists public.money_plan_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id uuid not null references public.money_plans(id) on delete cascade,
  name text not null,                       -- '월세', '비상금', '저축', '생활비' 등
  amount bigint not null default 0,
  account_id uuid references public.money_accounts(id) on delete set null,  -- 연동 통장(선택)
  is_living boolean not null default false, -- 생활비(한도) 항목 여부(계획당 1개)
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists money_plan_allocations_plan_idx
  on public.money_plan_allocations (plan_id, sort_order);
create index if not exists money_plan_allocations_user_idx
  on public.money_plan_allocations (user_id);

-- RLS: 단일 사용자 owner uid 하드코딩 FOR ALL (기존 머니 테이블과 동일).
do $$
declare uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
begin
  execute 'alter table public.money_plan_allocations enable row level security';
  execute 'drop policy if exists "owner only" on public.money_plan_allocations';
  execute format(
    'create policy "owner only" on public.money_plan_allocations for all to authenticated using (auth.uid() = %L) with check (auth.uid() = %L)',
    uid, uid);
end $$;

-- Realtime publication 등록(중복 skip) — PC↔모바일 즉시 반영.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'money_plan_allocations'
  ) then
    execute 'alter publication supabase_realtime add table public.money_plan_allocations';
  end if;
end $$;
