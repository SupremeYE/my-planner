-- 레시피 조리 기록(recipe_cook_logs) 테이블 생성 — Phase 1 B-2
-- 목적: 상세 화면 '만들었어요' 버튼으로 한 건 기록 + 선택적 완성 사진 업로드.
--   · 한 레시피에 여러 번 만들 수 있음(1:N), 시간순 타임라인으로 노출.
--   · recipes.cook_count / last_cooked_at 는 클라이언트가 별도로 갱신(기존 db.recipes.markCooked 재사용).
-- 컨벤션: recipes 와 동일하게 user_id DEFAULT auth.uid() + 본인 소유 RLS + Realtime publication 등록.

create table if not exists public.recipe_cook_logs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cooked_at timestamptz not null default now(),
  photo_url text,
  note text,
  created_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.recipe_cook_logs enable row level security;

drop policy if exists "Users can view their own cook logs"   on public.recipe_cook_logs;
drop policy if exists "Users can insert their own cook logs" on public.recipe_cook_logs;
drop policy if exists "Users can update their own cook logs" on public.recipe_cook_logs;
drop policy if exists "Users can delete their own cook logs" on public.recipe_cook_logs;

create policy "Users can view their own cook logs"
  on public.recipe_cook_logs for select using (auth.uid() = user_id);
create policy "Users can insert their own cook logs"
  on public.recipe_cook_logs for insert with check (auth.uid() = user_id);
create policy "Users can update their own cook logs"
  on public.recipe_cook_logs for update using (auth.uid() = user_id);
create policy "Users can delete their own cook logs"
  on public.recipe_cook_logs for delete using (auth.uid() = user_id);

-- ── 인덱스 ────────────────────────────────────────────────────────────────────
create index if not exists recipe_cook_logs_recipe_cooked_idx
  on public.recipe_cook_logs (recipe_id, cooked_at desc);
create index if not exists recipe_cook_logs_user_cooked_idx
  on public.recipe_cook_logs (user_id, cooked_at desc);

-- ── Realtime publication 등록 ────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recipe_cook_logs'
  ) then
    alter publication supabase_realtime add table public.recipe_cook_logs;
  end if;
end $$;
