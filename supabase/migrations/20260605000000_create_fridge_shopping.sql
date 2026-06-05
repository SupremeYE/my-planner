-- 레시피 모듈 Phase 2 — 냉장고(fridge_items) / 장보기(shopping_items) 테이블 생성
-- 목적: 냉장고 재고 관리 + 장보기 목록. (영수증/사진 인식·AI 파싱·냉장고↔레시피 연결은 Phase 3)
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션 — recipes/culture_records 패턴 동일):
--  - user_id 는 DEFAULT auth.uid() 로 자동 채운다. 클라이언트(db.ts)가 user_id 를 보내지 않아도
--    INSERT 시점의 로그인 사용자가 들어간다.
--  - RLS 는 "로그인한 본인(소유자)만" select/insert/update/delete 통일.
--  - shopping_items.source_recipe_id 는 Phase 3(부족 재료 자동 담기) 대비 컬럼만 미리 둠.
--    레시피 삭제 시 장보기 항목은 남기되 출처만 끊기게 ON DELETE SET NULL.
--  - Realtime: PC↔모바일 즉시 반영 원칙에 따라 두 테이블 모두 supabase_realtime publication 에 등록.

-- ── fridge_items (냉장고 재고) ───────────────────────────────────────────────
create table if not exists public.fridge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text not null default '냉장' check (category in ('냉장','냉동','실온')),
  quantity numeric not null default 1,
  unit text,
  expiry_date date,
  created_at timestamptz not null default now()
);

-- ── shopping_items (장보기 목록) ─────────────────────────────────────────────
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric not null default 1,
  unit text,
  source_recipe_id uuid references public.recipes(id) on delete set null,
  source_label text,
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.fridge_items   enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "Users can view their own fridge items"   on public.fridge_items;
drop policy if exists "Users can insert their own fridge items" on public.fridge_items;
drop policy if exists "Users can update their own fridge items" on public.fridge_items;
drop policy if exists "Users can delete their own fridge items" on public.fridge_items;

create policy "Users can view their own fridge items"
  on public.fridge_items for select using (auth.uid() = user_id);
create policy "Users can insert their own fridge items"
  on public.fridge_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own fridge items"
  on public.fridge_items for update using (auth.uid() = user_id);
create policy "Users can delete their own fridge items"
  on public.fridge_items for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own shopping items"   on public.shopping_items;
drop policy if exists "Users can insert their own shopping items" on public.shopping_items;
drop policy if exists "Users can update their own shopping items" on public.shopping_items;
drop policy if exists "Users can delete their own shopping items" on public.shopping_items;

create policy "Users can view their own shopping items"
  on public.shopping_items for select using (auth.uid() = user_id);
create policy "Users can insert their own shopping items"
  on public.shopping_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own shopping items"
  on public.shopping_items for update using (auth.uid() = user_id);
create policy "Users can delete their own shopping items"
  on public.shopping_items for delete using (auth.uid() = user_id);

-- ── 인덱스 ────────────────────────────────────────────────────────────────────
create index if not exists fridge_items_user_idx       on public.fridge_items (user_id, category, expiry_date);
create index if not exists shopping_items_user_idx      on public.shopping_items (user_id, is_checked, created_at);
create index if not exists shopping_items_recipe_idx    on public.shopping_items (source_recipe_id);

-- ── Realtime publication 등록 (이미 등록된 경우 skip) ─────────────────────────
do $$
declare tbl text;
begin
  foreach tbl in array array['fridge_items','shopping_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
