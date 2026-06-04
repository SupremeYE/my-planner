-- 레시피 모듈(recipes / recipe_ingredients / recipe_steps) 테이블 생성 — Phase 1
-- 목적: 레시피 직접입력 CRUD + 상세(별점·메모·인분 환산) + 릴스형 요리 뷰 + 단계별 타이머.
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션에 맞춤 — culture_records 패턴 동일):
--  - recipes.user_id 는 DEFAULT auth.uid() 로 자동 채운다. 클라이언트(db.ts)가 user_id 를
--    따로 보내지 않아도 INSERT 시점의 로그인 사용자가 들어간다.
--  - RLS 는 "로그인한 본인(소유자)만" 정책으로 select/insert/update/delete 통일.
--  - recipe_ingredients / recipe_steps 는 소속 recipe 소유권 기준(EXISTS)으로 정책 작성.
--  - 자식 테이블은 recipe_id ON DELETE CASCADE 로 레시피 삭제 시 함께 삭제.
--  - Realtime: PC↔모바일 즉시 반영 원칙에 따라 3개 테이블 모두 supabase_realtime publication 에 등록.

-- ── recipes (부모) ──────────────────────────────────────────────────────────
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null default 'manual' check (source_type in ('manual','link','reels','receipt','ai')),
  source_url text,
  thumbnail_url text,
  total_minutes integer,
  base_servings integer not null default 2 check (base_servings >= 1),
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── recipe_ingredients (재료) ────────────────────────────────────────────────
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  amount numeric,
  unit text,
  sort_order integer not null default 0
);

-- ── recipe_steps (요리 순서) ─────────────────────────────────────────────────
create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  step_no integer not null,
  instruction text not null,
  timer_seconds integer,
  sort_order integer not null default 0
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps       enable row level security;

-- recipes: 본인 소유 행만 CRUD
drop policy if exists "Users can view their own recipes"   on public.recipes;
drop policy if exists "Users can insert their own recipes" on public.recipes;
drop policy if exists "Users can update their own recipes" on public.recipes;
drop policy if exists "Users can delete their own recipes" on public.recipes;

create policy "Users can view their own recipes"
  on public.recipes for select using (auth.uid() = user_id);
create policy "Users can insert their own recipes"
  on public.recipes for insert with check (auth.uid() = user_id);
create policy "Users can update their own recipes"
  on public.recipes for update using (auth.uid() = user_id);
create policy "Users can delete their own recipes"
  on public.recipes for delete using (auth.uid() = user_id);

-- recipe_ingredients: 소속 recipe 소유권 기준
drop policy if exists "Users can view ingredients of their recipes"   on public.recipe_ingredients;
drop policy if exists "Users can insert ingredients of their recipes" on public.recipe_ingredients;
drop policy if exists "Users can update ingredients of their recipes" on public.recipe_ingredients;
drop policy if exists "Users can delete ingredients of their recipes" on public.recipe_ingredients;

create policy "Users can view ingredients of their recipes"
  on public.recipe_ingredients for select
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "Users can insert ingredients of their recipes"
  on public.recipe_ingredients for insert
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "Users can update ingredients of their recipes"
  on public.recipe_ingredients for update
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "Users can delete ingredients of their recipes"
  on public.recipe_ingredients for delete
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- recipe_steps: 소속 recipe 소유권 기준
drop policy if exists "Users can view steps of their recipes"   on public.recipe_steps;
drop policy if exists "Users can insert steps of their recipes" on public.recipe_steps;
drop policy if exists "Users can update steps of their recipes" on public.recipe_steps;
drop policy if exists "Users can delete steps of their recipes" on public.recipe_steps;

create policy "Users can view steps of their recipes"
  on public.recipe_steps for select
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "Users can insert steps of their recipes"
  on public.recipe_steps for insert
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "Users can update steps of their recipes"
  on public.recipe_steps for update
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "Users can delete steps of their recipes"
  on public.recipe_steps for delete
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- ── 인덱스 ────────────────────────────────────────────────────────────────────
create index if not exists recipes_user_created_idx       on public.recipes (user_id, created_at desc);
create index if not exists recipe_ingredients_recipe_idx  on public.recipe_ingredients (recipe_id, sort_order);
create index if not exists recipe_steps_recipe_idx        on public.recipe_steps (recipe_id, sort_order);

-- ── Realtime publication 등록 (이미 등록된 경우 skip) ─────────────────────────
do $$
declare tbl text;
begin
  foreach tbl in array array['recipes','recipe_ingredients','recipe_steps'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
