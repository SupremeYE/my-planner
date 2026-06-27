-- 하온 머니 페이지 — Stage 1 (DB)
-- 머니 모듈 8개 테이블 생성 + RLS + 시드.
--   가계부: money_transactions(거래) · money_categories(카테고리) · money_settings(예산/급여일)
--   자산:   money_accounts(통장·예금·신용카드) · money_loans(대출)
--   투자:   money_investments(주식·펀드·코인)
--   계획:   money_goals(저축 목표) · 고정비: money_fixed_costs(구독·통신·보험 등)
--
-- 컨벤션(기존 테이블과 동일 — beauty_housekeeping_tables 레퍼런스):
--   - id uuid pk default gen_random_uuid()
--   - user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
--   - created_at timestamptz default now()
--   - category/kind/type 류는 추후 확장 위해 CHECK 없이 free text
--   - RLS: 단일 사용자 owner uid 하드코딩 FOR ALL (user_symptoms / lockdown / beauty 동일 구문)
--   - realtime publication add (중복 방지 가드)
--   - 인덱스: {table}_user_created_idx (user_id, created_at desc)
--
-- 금액은 모두 numeric(원화 환산 기준). 외화 고정비는 original_amount+currency 로 원금액 보존,
-- 환율 환산은 런타임(클라이언트)에서 처리 — 정적 데이터는 "한 번 저장, 영원히 읽기" 원칙.

-- ── 1) money_settings — 머니 설정(월 예산 / 급여일 / 예산기간 기준 / 통화). 사용자당 1행 ──
create table if not exists public.money_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  budget_basis text not null default 'payday',  -- 'monthly'(1일~말일) | 'payday'(급여일 기준)
  pay_day int not null default 25,               -- 급여일(매월)
  monthly_budget numeric not null default 1200000,
  currency text not null default 'KRW',          -- 기본 표시 통화
  created_at timestamptz default now()
);

-- ── 2) money_categories — 지출/수입 카테고리(프리셋 + 커스텀). 차트 색상은 의미론적 상수 ──
create table if not exists public.money_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'expense',  -- 'expense' | 'income'
  emoji text,
  color text,                            -- hex (8색 카테고리 상수 또는 커스텀)
  sort_order int default 0,
  is_default boolean default false,      -- 기본 프리셋 vs 사용자 추가
  created_at timestamptz default now()
);

-- ── 3) money_accounts — 통장 · 예금 · 신용카드 ────────────────────────────────
create table if not exists public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'bank',     -- 'bank' | 'savings' | 'credit_card'
  balance numeric default 0,             -- 예금=잔액(양수), 신용카드=미결제액(양수)
  payment_day int,                       -- 신용카드 결제일
  interest_rate numeric,                 -- 예·적금 금리(연 %)
  icon text,
  memo text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ── 4) money_transactions — 거래 내역(수입/지출). 가계부·캘린더·차트의 단일 출처 ──
create table if not exists public.money_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'expense',  -- 'expense' | 'income'
  amount numeric not null,
  category text,                         -- 카테고리 이름(denormalized — 카테고리 삭제와 무관하게 보존)
  account text,                          -- 결제수단/계좌 이름(예: 삼성카드)
  date date not null,
  memo text,                             -- 표시용 메모(예: "갈비 사먹음")
  emoji text,                            -- 거래 이모지
  raw_input text,                        -- 채팅/SMS 원문 보관(파싱 출처 추적용)
  created_at timestamptz default now()
);

-- ── 5) money_fixed_costs — 고정비(구독·통신·보험·주거·운동 등) ────────────────
create table if not exists public.money_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,               -- 원화 환산 금액(외화면 추정 환산값)
  currency text not null default 'KRW',  -- 'KRW' | 'USD' | 'EUR' | 'JPY'
  original_amount numeric,               -- 외화 원금액(예: 13.99) — currency!=KRW 일 때
  cycle text not null default 'monthly', -- 'monthly' | 'weekly' | 'yearly'
  payment_day int,                       -- 결제일(매월 N일)
  payment_method text,                   -- 삼성카드 / 자동이체 등
  category text,                         -- 구독/통신/보험/주거/운동/대출상환/기타
  icon text,
  is_variable boolean default false,     -- 변동 고정비(관리비 등)
  created_at timestamptz default now()
);

-- ── 6) money_loans — 대출 상세 ────────────────────────────────────────────────
create table if not exists public.money_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  lender text,                           -- 한국장학재단 / 카카오뱅크 등
  loan_type text,                        -- 원리금균등 등
  principal numeric,                     -- 최초 원금
  balance numeric not null default 0,    -- 현재 원금 잔액
  interest_rate numeric,                 -- 이자율(연 %)
  monthly_payment numeric,               -- 월 상환액
  start_date date,
  end_date date,
  total_installments int,                -- 총 회차
  paid_installments int default 0,       -- 납입 회차
  payment_day int,                       -- 상환일
  created_at timestamptz default now()
);

-- ── 7) money_investments — 투자 포트폴리오(주식·펀드·코인) ────────────────────
create table if not exists public.money_investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,                    -- 종목명(삼성전자 등)
  ticker text,
  asset_type text not null default 'stock', -- 'stock' | 'fund' | 'crypto'
  quantity numeric default 0,
  avg_buy_price numeric default 0,       -- 평균 매입가
  current_price numeric default 0,       -- 현재가(정적 저장, 환율만 런타임 예외)
  currency text not null default 'KRW',
  created_at timestamptz default now()
);

-- ── 8) money_goals — 저축 목표/계획(단기·장기) ───────────────────────────────
create table if not exists public.money_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  target_amount numeric not null,
  current_amount numeric default 0,
  deadline date,
  monthly_contribution numeric,          -- 월 필요/자동 적립액
  goal_term text default 'short',        -- 'short'(단기) | 'long'(장기)
  color text,
  auto_day int,                          -- 매월 자동 적립일
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ── RLS: 단일 사용자 owner uid 하드코딩 FOR ALL (beauty / user_symptoms / lockdown 동일) ──
DO $$
DECLARE
  uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
  t text;
  tbls text[] := ARRAY[
    'money_settings','money_categories','money_accounts','money_transactions',
    'money_fixed_costs','money_loans','money_investments','money_goals'
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
create index if not exists money_categories_user_created_idx
  on public.money_categories (user_id, created_at desc);
create index if not exists money_accounts_user_created_idx
  on public.money_accounts (user_id, created_at desc);
create index if not exists money_transactions_user_created_idx
  on public.money_transactions (user_id, created_at desc);
create index if not exists money_transactions_user_date_idx
  on public.money_transactions (user_id, date desc);   -- 캘린더/기간 집계
create index if not exists money_fixed_costs_user_created_idx
  on public.money_fixed_costs (user_id, created_at desc);
create index if not exists money_loans_user_created_idx
  on public.money_loans (user_id, created_at desc);
create index if not exists money_investments_user_created_idx
  on public.money_investments (user_id, created_at desc);
create index if not exists money_goals_user_created_idx
  on public.money_goals (user_id, created_at desc);

-- ── Realtime publication 등록 (이미 등록된 경우 skip) ──────────────────────────
do $$
declare
  t text;
  tbls text[] := ARRAY[
    'money_settings','money_categories','money_accounts','money_transactions',
    'money_fixed_costs','money_loans','money_investments','money_goals'
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

-- ── 시드 데이터 ───────────────────────────────────────────────────────────────
-- 각 INSERT 는 "해당 테이블에 이 유저 행이 없을 때만" 실행 → 재실행해도 중복 안 됨(idempotent).
-- uid = 8451b11f-76ed-4dcb-a9ec-bd8283fa1cde (단일 사용자)

-- (1) settings — 월 예산 120만, 급여일 25일, 급여일 기준, 원화
insert into public.money_settings (user_id, budget_basis, pay_day, monthly_budget, currency)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', 'payday', 25, 1200000, 'KRW'
where not exists (
  select 1 from public.money_settings where user_id = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'
);

-- (2) categories — 지출 8 + 수입 5 (차트 8색 의미론 상수 매핑)
insert into public.money_categories (user_id, name, kind, emoji, color, sort_order, is_default)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', name, kind, emoji, color, sort_order, true
from (values
  ('식비',     'expense', '🍚', '#D4735A', 0),
  ('생필품',   'expense', '🛒', '#C4A882', 1),
  ('교통',     'expense', '🚌', '#6BAA7A', 2),
  ('카페',     'expense', '☕', '#7A7265', 3),
  ('쇼핑',     'expense', '👗', '#E8A84C', 4),
  ('문화',     'expense', '🎬', '#8B7EC8', 5),
  ('건강',     'expense', '💊', '#5B9BD5', 6),
  ('기타',     'expense', '📦', '#B8AD9E', 7),
  ('급여',     'income',  '💰', '#6BAA7A', 0),
  ('부수입',   'income',  '💼', '#8B7EC8', 1),
  ('용돈/선물','income',  '🎁', '#E8A84C', 2),
  ('투자수익', 'income',  '📈', '#5B9BD5', 3),
  ('기타수입', 'income',  '➕', '#B8AD9E', 4)
) as v(name, kind, emoji, color, sort_order)
where not exists (
  select 1 from public.money_categories where user_id = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'
);

-- (3) accounts — 카뱅 저금통(예금) + 삼성/하나 신용카드(미결제액·결제일)
insert into public.money_accounts (user_id, name, type, balance, payment_day, interest_rate, icon)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', name, type, balance, payment_day, interest_rate, icon
from (values
  ('카뱅 저금통', 'bank',        80333123::numeric, null::int, 0::numeric,    '🏦'),
  ('삼성카드',    'credit_card',   304000::numeric, 18::int,   null::numeric, '💳'),
  ('하나카드',    'credit_card',   400000::numeric, 20::int,   null::numeric, '💳')
) as v(name, type, balance, payment_day, interest_rate, icon)
where not exists (
  select 1 from public.money_accounts where user_id = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'
);

-- (4) transactions — 최근 거래 3건(6월): 갈비/보건/월급
insert into public.money_transactions (user_id, kind, amount, category, account, date, memo, emoji)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', kind, amount, category, account, date::date, memo, emoji
from (values
  ('expense', 54000::numeric,   '식비',   '삼성카드', '2026-06-24', '갈비 사먹음',  '🍖'),
  ('expense', 50000::numeric,   '건강',   '하나카드', '2026-06-24', '보건/위생',   '💊'),
  ('income',  2500000::numeric, '급여',   '카뱅 저금통', '2026-06-25', '6월 월급',  '💰')
) as v(kind, amount, category, account, date, memo, emoji)
where not exists (
  select 1 from public.money_transactions where user_id = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'
);

-- (5) fixed_costs — 고정비 7건(외화 구독 2건 포함)
insert into public.money_fixed_costs
  (user_id, name, amount, currency, original_amount, cycle, payment_day, payment_method, category, icon, is_variable)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', name, amount, currency, original_amount, cycle, payment_day, payment_method, category, icon, is_variable
from (values
  ('넷플릭스',        19194::numeric,  'USD', 13.99::numeric, 'monthly', 1::int,  '삼성카드', '구독', '🎬', false),
  ('Spotify',         15100::numeric,  'USD', 10.99::numeric, 'monthly', 28::int, '하나카드', '구독', '🎵', false),
  ('유튜브 프리미엄', 14900::numeric,  'KRW', null::numeric,  'monthly', 5::int,  '삼성카드', '구독', '▶️', false),
  ('통신비 (KT)',     55000::numeric,  'KRW', null::numeric,  'monthly', 15::int, '자동이체', '통신', '📱', false),
  ('실비보험',        89000::numeric,  'KRW', null::numeric,  'monthly', 20::int, '자동이체', '보험', '🛡️', false),
  ('헬스장',          99000::numeric,  'KRW', null::numeric,  'monthly', 25::int, '하나카드', '운동', '🏋️', false),
  ('관리비',          120000::numeric, 'KRW', null::numeric,  'monthly', 10::int, '자동이체', '주거', '🏠', true)
) as v(name, amount, currency, original_amount, cycle, payment_day, payment_method, category, icon, is_variable)
where not exists (
  select 1 from public.money_fixed_costs where user_id = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'
);

-- (6) loans — 학자금 + 신용대출 2건
insert into public.money_loans
  (user_id, name, lender, loan_type, principal, balance, interest_rate, monthly_payment,
   start_date, end_date, total_installments, paid_installments, payment_day)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', name, lender, loan_type, principal, balance, interest_rate, monthly_payment,
   start_date::date, end_date::date, total_installments, paid_installments, payment_day
from (values
  ('학자금 대출', '한국장학재단', '원리금균등', 20000000::numeric, 15000000::numeric, 1.7::numeric, 350000::numeric,
   '2024-03-01', '2028-03-01', 48::int, 27::int, 12::int),
  ('신용대출',   '카카오뱅크',   '원리금균등', 15000000::numeric,  9500000::numeric, 4.5::numeric, 280000::numeric,
   '2025-01-01', '2028-01-01', 36::int, 17::int, 7::int)
) as v(name, lender, loan_type, principal, balance, interest_rate, monthly_payment,
       start_date, end_date, total_installments, paid_installments, payment_day)
where not exists (
  select 1 from public.money_loans where user_id = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'
);

-- (7) goals — 저축 목표 3건(비상금/자산1억/일본여행)
insert into public.money_goals
  (user_id, name, emoji, target_amount, current_amount, deadline, monthly_contribution, goal_term, color, auto_day, sort_order)
select '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde', name, emoji, target_amount, current_amount, deadline::date, monthly_contribution, goal_term, color, auto_day, sort_order
from (values
  ('비상금 1000만원',   '🎯', 10000000::numeric,  6700000::numeric, '2026-12-31',  550000::numeric, 'short', '#6BAA7A', 25::int, 0),
  ('30살 전 자산 1억',  '🏠', 100000000::numeric, 79629123::numeric, '2028-03-15',  970042::numeric, 'long',  '#C4A882', null::int, 1),
  ('일본 여행 자금',    '✈️', 3000000::numeric,    900000::numeric, '2026-09-01', 1050000::numeric, 'short', '#D4735A', 25::int, 2)
) as v(name, emoji, target_amount, current_amount, deadline, monthly_contribution, goal_term, color, auto_day, sort_order)
where not exists (
  select 1 from public.money_goals where user_id = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'
);

-- (8) investments — 시드 없음(목업이 빈 상태 "아직 등록된 투자 내역이 없어요"). 테이블만 준비.
