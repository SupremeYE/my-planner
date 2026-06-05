-- 비전보드(Vision Board) — Phase 1
-- 목적: "되고 싶은 나·살고 싶은 하루"를 이미지로 걸어두는 감정·미래 지향 보드.
--
-- 설계 메모:
--  - 단일 사용자 Auth 컨벤션(culture_records, moments 패턴)에 맞춤.
--    user_id 는 DEFAULT auth.uid() 로 자동 충전 → 클라이언트가 보내지 않는다.
--  - 기본 카테고리 시드("올해의 나"/"여행"/"공간"/"습관"/"마음")는 user_id 를
--    마이그레이션 시점에 알 수 없으므로 클라이언트(db.ts visionCategories.ensureSeed)
--    에서 첫 조회가 빈 배열일 때 한 번만 insert 한다.
--  - vision_items.category_id 는 ON DELETE SET NULL — 카테고리 삭제 시 항목은
--    "미분류"로 보존(요구사항 Phase 4).
--  - 정렬: sort_order asc, 동률은 created_at desc.
--  - Storage 버킷 'vision-board' (public, 소유자 RLS) — 이미지 업로드용.

-- ── 1) vision_categories ────────────────────────────────────────────────
create table if not exists public.vision_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.vision_categories enable row level security;

drop policy if exists "Users can view their own vision_categories"   on public.vision_categories;
drop policy if exists "Users can insert their own vision_categories" on public.vision_categories;
drop policy if exists "Users can update their own vision_categories" on public.vision_categories;
drop policy if exists "Users can delete their own vision_categories" on public.vision_categories;

create policy "Users can view their own vision_categories"
  on public.vision_categories for select using (auth.uid() = user_id);
create policy "Users can insert their own vision_categories"
  on public.vision_categories for insert with check (auth.uid() = user_id);
create policy "Users can update their own vision_categories"
  on public.vision_categories for update using (auth.uid() = user_id);
create policy "Users can delete their own vision_categories"
  on public.vision_categories for delete using (auth.uid() = user_id);

create index if not exists vision_categories_user_sort_idx
  on public.vision_categories (user_id, sort_order asc, created_at asc);

-- ── 2) vision_items ─────────────────────────────────────────────────────
create table if not exists public.vision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  image_url text,
  caption text,
  category_id uuid references public.vision_categories(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.vision_items enable row level security;

drop policy if exists "Users can view their own vision_items"   on public.vision_items;
drop policy if exists "Users can insert their own vision_items" on public.vision_items;
drop policy if exists "Users can update their own vision_items" on public.vision_items;
drop policy if exists "Users can delete their own vision_items" on public.vision_items;

create policy "Users can view their own vision_items"
  on public.vision_items for select using (auth.uid() = user_id);
create policy "Users can insert their own vision_items"
  on public.vision_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own vision_items"
  on public.vision_items for update using (auth.uid() = user_id);
create policy "Users can delete their own vision_items"
  on public.vision_items for delete using (auth.uid() = user_id);

create index if not exists vision_items_user_sort_idx
  on public.vision_items (user_id, sort_order asc, created_at desc);
create index if not exists vision_items_user_category_idx
  on public.vision_items (user_id, category_id);

-- ── 3) Realtime publication ─────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vision_categories'
  ) then
    alter publication supabase_realtime add table public.vision_categories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vision_items'
  ) then
    alter publication supabase_realtime add table public.vision_items;
  end if;
end $$;

-- ── 4) Storage 버킷 (이미지 업로드) ─────────────────────────────────────
-- moment-photos / food-photos 와 동일한 public 버킷 + 소유자 RLS 정책.
insert into storage.buckets (id, name, public)
values ('vision-board', 'vision-board', true)
on conflict (id) do nothing;

drop policy if exists "Vision board public read"    on storage.objects;
drop policy if exists "Vision board owner insert"   on storage.objects;
drop policy if exists "Vision board owner update"   on storage.objects;
drop policy if exists "Vision board owner delete"   on storage.objects;

create policy "Vision board public read"
  on storage.objects for select
  using (bucket_id = 'vision-board');

create policy "Vision board owner insert"
  on storage.objects for insert
  with check (bucket_id = 'vision-board' and auth.role() = 'authenticated');

create policy "Vision board owner update"
  on storage.objects for update
  using (bucket_id = 'vision-board' and auth.role() = 'authenticated');

create policy "Vision board owner delete"
  on storage.objects for delete
  using (bucket_id = 'vision-board' and auth.role() = 'authenticated');
