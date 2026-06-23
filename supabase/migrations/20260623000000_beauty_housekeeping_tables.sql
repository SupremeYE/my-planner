-- 하온 / 뷰티 케어 · 살림 신규 메뉴 — Stage 1 (DB)
-- 서로 독립된 두 메뉴(뷰티 케어 / 살림)가 공유하는 5개 테이블 생성.
--   뷰티: beauty_products(보유함) · beauty_special_care(스페셜케어)
--   살림: household_items(재고) · consumable_cycles(소모품 교체주기) · cleaning_zones(청소구역)
--
-- 컨벤션(기존 테이블과 동일):
--   - id uuid pk default gen_random_uuid()
--   - user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
--   - created_at timestamptz default now()
--   - category 류는 추후 확장 위해 CHECK 없이 free text
--   - RLS: 단일 사용자 owner uid 하드코딩 FOR ALL (user_symptoms / lockdown 과 동일 구문)
--   - realtime publication add (중복 방지 가드)
--   - 인덱스: {table}_user_created_idx (user_id, created_at desc)

-- ── 1) beauty_products — 뷰티 보유함 ───────────────────────────────────────────
create table if not exists public.beauty_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  category text,
  photo_url text,
  opened_at date,            -- 개봉일(재구매 시 today 로 리셋)
  expiry_months int,         -- 개봉 후 사용기한(PAO). 잔여 = opened_at + expiry_months
  purchase_place text,
  price numeric,
  link text,
  memo text,
  is_active boolean default true,   -- 다 쓴 제품 보관용
  created_at timestamptz default now()
);

-- ── 2) beauty_special_care — 스페셜케어(마지막 N일 + 오늘 했어요) ──────────────
create table if not exists public.beauty_special_care (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  cycle_days int,
  done_dates text[] default '{}',   -- 'yyyy-MM-dd', getStreak 패턴 재사용
  created_at timestamptz default now()
);

-- ── 3) household_items — 살림 재고 ─────────────────────────────────────────────
create table if not exists public.household_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text,
  quantity numeric default 1,
  unit text,
  threshold_qty numeric default 1,  -- "곧 떨어져요" 임계. 소진 = quantity<=0 으로 파생(컬럼 없음)
  brand text,
  purchase_place text,
  price numeric,
  link text,
  memo text,
  photo_url text,
  created_at timestamptz default now()
);

-- ── 4) consumable_cycles — 소모품 교체주기 ────────────────────────────────────
create table if not exists public.consumable_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  cycle_days int not null,
  replaced_dates text[] default '{}',  -- restart = today push + 카운트 리셋
  created_at timestamptz default now()
);

-- ── 5) cleaning_zones — 청소구역 먼지 히트맵 ──────────────────────────────────
create table if not exists public.cleaning_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  cleaned_dates text[] default '{}',
  created_at timestamptz default now()
);

-- ── RLS: 단일 사용자 owner uid 하드코딩 FOR ALL (user_symptoms / lockdown 동일) ──
DO $$
DECLARE
  uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
  t text;
  tbls text[] := ARRAY[
    'beauty_products','beauty_special_care','household_items','consumable_cycles','cleaning_zones'
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
create index if not exists beauty_products_user_created_idx
  on public.beauty_products (user_id, created_at desc);
create index if not exists beauty_special_care_user_created_idx
  on public.beauty_special_care (user_id, created_at desc);
create index if not exists household_items_user_created_idx
  on public.household_items (user_id, created_at desc);
create index if not exists household_items_user_category_idx
  on public.household_items (user_id, category);
create index if not exists consumable_cycles_user_created_idx
  on public.consumable_cycles (user_id, created_at desc);
create index if not exists cleaning_zones_user_created_idx
  on public.cleaning_zones (user_id, created_at desc);

-- ── Realtime publication 등록 (이미 등록된 경우 skip) ──────────────────────────
do $$
declare
  t text;
  tbls text[] := ARRAY[
    'beauty_products','beauty_special_care','household_items','consumable_cycles','cleaning_zones'
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
