-- 하온 머니 페이지 — Stage 1 (DB, 개정판)
-- 머니 모듈 8개 테이블 생성 + RLS + 시드.
--   가계부: money_categories(카테고리) · money_transactions(거래) · money_settings(예산/급여일)
--   자산:   money_accounts(통장·현금·투자계좌) · money_cards(신용/체크카드) · money_loans(대출)
--   투자:   money_accounts.type = 'investment' 로 통합 관리(별도 테이블 없음)
--   계획:   money_goals(저축 목표) · 고정비: money_fixed_costs(구독·통신·보험 등)
--
-- 컨벤션(기존 beauty_housekeeping 레퍼런스 동일):
--   - id uuid pk default gen_random_uuid()
--   - user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
--   - created_at timestamptz default now()
--   - type/category 류는 추후 확장 위해 CHECK 없이 free text
--   - RLS: 단일 사용자 owner uid 하드코딩 FOR ALL (user_symptoms / lockdown / beauty 동일)
--   - realtime publication add (중복 방지 가드)
--   - 인덱스: {table}_user_created_idx (user_id, created_at desc)
--
-- 금액은 원화 기준 bigint(원 단위). 외화 고정비는 original_amount(numeric)+currency 로 원금액 보존,
-- 환율 환산은 런타임(클라이언트) 처리 — 정적 데이터 "한 번 저장, 영원히 읽기" 원칙(환율만 예외).

-- 멱등 재적용을 위해 기존 머니 테이블 제거(초기 시드 전용 → 안전). investments 는 accounts 로 통합되어 폐기.
drop table if exists public.money_transactions cascade;
drop table if exists public.money_fixed_costs cascade;
drop table if exists public.money_goals cascade;
drop table if exists public.money_loans cascade;
drop table if exists public.money_cards cascade;
drop table if exists public.money_accounts cascade;
drop table if exists public.money_categories cascade;
drop table if exists public.money_investments cascade;  -- 구(舊) 스키마 잔재 제거
drop table if exists public.money_settings cascade;

-- ── 1) money_categories — 지출/수입 카테고리(프리셋 + 커스텀) ─────────────────
create table public.money_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null default 'expense',  -- 'expense' | 'income'
  name text not null,
  emoji text,
  color text,                            -- hex (차트 8색 의미론 상수 또는 커스텀)
  is_default boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ── 2) money_transactions — 거래 내역(핵심). 가계부·캘린더·차트 단일 출처 ─────
create table public.money_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null default 'expense',  -- 'expense' | 'income'
  amount bigint not null,                -- 원화 기준(원 단위)
  category_id uuid references public.money_categories(id) on delete set null,
  memo text,
  payment_method text,                   -- '삼성카드' 등(nullable)
  spent_at date not null,                -- 거래 날짜
  source text default 'manual',          -- 'chat' | 'sms' | 'manual' | 'fixed'
  raw_input text,                        -- 채팅/문자 원문(파싱 추적용, nullable)
  emoji text,                            -- 거래별 이모지(🍖 등). 없으면 카테고리 이모지로 폴백.
  created_at timestamptz default now()
);

-- ── 3) money_accounts — 자산(통장/현금/투자계좌) ──────────────────────────────
create table public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'deposit', -- 'deposit' | 'savings' | 'cash' | 'investment'
  balance bigint default 0,
  interest_rate numeric,                 -- 연이율(nullable)
  icon text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ── 4) money_cards — 신용/체크카드 ───────────────────────────────────────────
create table public.money_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'credit',  -- 'credit' | 'check'
  color text,
  billing_day int,                       -- 결제일(신용카드만, nullable)
  unpaid_amount bigint default 0,        -- 미결제액
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ── 5) money_fixed_costs — 고정비(구독·통신·보험·주거·운동 등) ────────────────
create table public.money_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount bigint not null,                -- 원화 환산 금액(외화면 추정 환산값)
  original_amount numeric,               -- 외화 원금액(예: 13.99) — currency!=KRW 일 때
  currency text not null default 'KRW',  -- 'KRW' | 'USD' | 'EUR' | 'JPY'
  cycle text not null default 'monthly', -- 'monthly' | 'weekly' | 'yearly'
  billing_day int,                       -- 결제일
  payment_method text,                   -- 삼성카드 / 자동이체 등
  category_id uuid references public.money_categories(id) on delete set null,
  is_variable boolean default false,     -- 변동 고정비(관리비 등)
  emoji text,
  created_at timestamptz default now()
);

-- ── 6) money_loans — 대출 상세 ────────────────────────────────────────────────
create table public.money_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  lender text,                           -- 한국장학재단 / 카카오뱅크 등
  repayment_type text,                   -- 원리금균등 등
  principal bigint,                      -- 최초 원금
  balance bigint not null default 0,     -- 현재 잔액
  interest_rate numeric,                 -- 이자율(연 %)
  monthly_payment bigint,                -- 월 상환액
  start_date date,
  end_date date,
  payment_day int,                       -- 매월 상환일
  total_installments int,                -- 총 회차
  paid_installments int default 0,       -- 상환 완료 회차
  created_at timestamptz default now()
);

-- ── 7) money_goals — 저축 목표/계획(단기·장기) ───────────────────────────────
create table public.money_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  target_amount bigint not null,
  current_amount bigint default 0,
  deadline date,
  type text default 'savings',           -- 'savings' | 'networth' | 'travel' | 'custom'
  linked_account_id uuid references public.money_accounts(id) on delete set null,
  color text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ── 8) money_settings — 사용자별 머니 설정(user_id PK, 1행) ───────────────────
create table public.money_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  period_type text not null default 'payday',   -- 'calendar'(1일~말일) | 'payday'(급여일 기준)
  payday int not null default 25,
  monthly_budget bigint not null default 1200000,
  currency text not null default 'KRW',
  fx_alert_threshold numeric not null default 3.0,  -- 환율 알림 임계 ±%
  created_at timestamptz default now()
);

-- ── RLS: 단일 사용자 owner uid 하드코딩 FOR ALL ──────────────────────────────
DO $$
DECLARE
  uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
  t text;
  tbls text[] := ARRAY[
    'money_categories','money_transactions','money_accounts','money_cards',
    'money_fixed_costs','money_loans','money_goals','money_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner only" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "owner only" ON public.%I FOR ALL TO authenticated USING (auth.uid() = %L) WITH CHECK (auth.uid() = %L)',
      t, uid, uid
    );
  END LOOP;
END $$;

-- ── 인덱스 ────────────────────────────────────────────────────────────────────
create index if not exists money_categories_user_created_idx on public.money_categories (user_id, created_at desc);
create index if not exists money_transactions_user_created_idx on public.money_transactions (user_id, created_at desc);
create index if not exists money_transactions_user_spent_idx on public.money_transactions (user_id, spent_at desc);  -- 캘린더/기간 집계
create index if not exists money_accounts_user_created_idx on public.money_accounts (user_id, created_at desc);
create index if not exists money_cards_user_created_idx on public.money_cards (user_id, created_at desc);
create index if not exists money_fixed_costs_user_created_idx on public.money_fixed_costs (user_id, created_at desc);
create index if not exists money_loans_user_created_idx on public.money_loans (user_id, created_at desc);
create index if not exists money_goals_user_created_idx on public.money_goals (user_id, created_at desc);

-- ── Realtime publication 등록(중복 skip) ──────────────────────────────────────
do $$
declare
  t text;
  tbls text[] := ARRAY[
    'money_categories','money_transactions','money_accounts','money_cards',
    'money_fixed_costs','money_loans','money_goals','money_settings'
  ];
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

-- ── 시드 데이터 (uid = 8451b11f-76ed-4dcb-a9ec-bd8283fa1cde) ──────────────────
-- DROP 후 재생성이라 시드는 항상 비어 있는 상태에서 1회 삽입.

-- (1) settings — 급여일 기준, 급여일 25, 월예산 120만, 원화, 환율알림 ±3%
insert into public.money_settings (user_id, period_type, payday, monthly_budget, currency, fx_alert_threshold)
values ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', 'payday', 25, 1200000, 'KRW', 3.0);

-- (2) categories — 지출 11 + 수입 4 (차트 의미론 상수). 고정비 ②안: 구독/보험/주거 프리셋 추가
insert into public.money_categories (user_id, type, name, emoji, color, is_default, sort_order)
values
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','식비',  '🍚','#D4735A',true,0),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','생필품','🛒','#C4A882',true,1),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','교통',  '🚌','#6BAA7A',true,2),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','카페',  '☕','#7A7265',true,3),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','쇼핑',  '👗','#E8A84C',true,4),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','문화',  '🎬','#8B7EC8',true,5),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','건강',  '💊','#5B9BD5',true,6),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','통신',  '📱','#B8AD9E',true,7),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','구독',  '🎬','#A88BC8',true,8),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','보험',  '🛡️','#7BA8B8',true,9),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','expense','주거',  '🏠','#C8956B',true,10),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','income','급여',   '💰','#4E9E6A',true,0),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','income','부수입', '💼','#7FB8A0',true,1),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','income','용돈/선물','🎁','#E091A8',true,2),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','income','투자수익','📈','#4FA3C7',true,3);

-- (3) accounts — 카뱅 저금통(예금). 투자계좌는 목업 빈 상태라 미시드.
insert into public.money_accounts (user_id, name, type, balance, interest_rate, icon, sort_order)
values ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','카뱅 저금통','deposit',80333123,0,'🏦',0);

-- (4) cards — 삼성/하나 신용카드(미결제액·결제일)
insert into public.money_cards (user_id, name, type, color, billing_day, unpaid_amount, sort_order)
values
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','삼성카드','credit','#5B9BD5',18,304000,0),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','하나카드','credit','#6BAA7A',20,400000,1);

-- (5) transactions — 최근 3건. category_id 는 이름으로 조인.
insert into public.money_transactions (user_id, type, amount, category_id, memo, payment_method, spent_at, source, emoji)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', v.type, v.amount,
       (select id from public.money_categories c
         where c.user_id='8451b11f-76ed-4dcb-a9ec-bd8283fa1cde' and c.name=v.cat and c.type=v.type limit 1),
       v.memo, v.pm, v.spent_at::date, 'manual', v.emoji
from (values
  ('expense',54000::bigint,  '식비','갈비 사먹음','삼성카드','2026-06-24','🍖'),
  ('expense',50000::bigint,  '건강','보건/위생', '하나카드','2026-06-24','💊'),
  ('income', 2500000::bigint,'급여','6월 월급',  '카뱅 저금통','2026-06-25','💰')
) as v(type, amount, cat, memo, pm, spent_at, emoji);

-- (6) fixed_costs — 7건(외화 구독 2건 포함). category_id 를 프리셋 카테고리에 전부 연결
--     (②안: 구독/보험/주거 프리셋 추가됨 → 고정비도 정상 카테고리 집계에 포함).
insert into public.money_fixed_costs
  (user_id, name, amount, original_amount, currency, cycle, billing_day, payment_method, category_id, is_variable, emoji)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', v.name, v.amount, v.orig, v.cur, 'monthly', v.bday, v.pm,
       (select id from public.money_categories c
         where c.user_id='8451b11f-76ed-4dcb-a9ec-bd8283fa1cde' and c.name=v.catname and c.type='expense' limit 1),
       v.isvar, v.emoji
from (values
  ('넷플릭스',       19194::bigint, 13.99::numeric, 'USD', 1::int,  '삼성카드', '구독', false, '🎬'),
  ('Spotify',        15100::bigint, 10.99::numeric, 'USD', 28::int, '하나카드', '구독', false, '🎵'),
  ('유튜브 프리미엄',14900::bigint, null::numeric,  'KRW', 5::int,  '삼성카드', '구독', false, '▶️'),
  ('통신비 (KT)',    55000::bigint, null::numeric,  'KRW', 15::int, '자동이체', '통신', false, '📱'),
  ('실비보험',       89000::bigint, null::numeric,  'KRW', 20::int, '자동이체', '보험', false, '🛡️'),
  ('헬스장',         99000::bigint, null::numeric,  'KRW', 25::int, '하나카드', '건강', false, '🏋️'),
  ('관리비',        120000::bigint, null::numeric,  'KRW', 10::int, '자동이체', '주거', true,  '🏠')
) as v(name, amount, orig, cur, bday, pm, catname, isvar, emoji);

-- (7) loans — 학자금 + 신용대출 2건
insert into public.money_loans
  (user_id, name, lender, repayment_type, principal, balance, interest_rate, monthly_payment,
   start_date, end_date, payment_day, total_installments, paid_installments)
values
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','학자금 대출','한국장학재단','원리금균등',20000000,15000000,1.7,350000,'2024-03-01','2028-03-01',12,48,27),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','신용대출','카카오뱅크','원리금균등',15000000,9500000,4.5,280000,'2025-01-01','2028-01-01',7,36,17);

-- (8) goals — 저축 목표 3건
insert into public.money_goals
  (user_id, name, emoji, target_amount, current_amount, deadline, type, color, sort_order)
values
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','비상금 1000만원','🎯',10000000,6700000,'2026-12-31','savings','#6BAA7A',0),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','30살 전 자산 1억','🏠',100000000,79629123,'2028-03-15','networth','#C4A882',1),
  ('8451b11f-76ed-4dcb-a9ec-bd8283fa1cde','일본 여행 자금','✈️',3000000,900000,'2026-09-01','travel','#D4735A',2);
