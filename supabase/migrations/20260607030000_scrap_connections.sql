-- 스크랩 / 영감 보관함 — Stage 4 (연결: 비전보드/할일/저널)
--
-- 목적: ScrapDetailSheet 의 "연결" 버튼이 실제로
--       vision_items / todos / diary_entries(신규) 로 승격되도록
--       기존 테이블에 url / source / 메모 컬럼을 보강하고,
--       자유 일기 테이블(diary_entries) 을 신규 생성한다.
--
-- 설계 메모:
--  - 기존 단일 사용자 컨벤션을 그대로 따른다(user_id 는 DEFAULT auth.uid()).
--  - vision_items / todos 는 컬럼만 추가(default null), 기존 행에 영향 없음.
--  - diary_entries 는 RLS + Realtime 까지 한 마이그레이션에서 함께 설정.

-- ── 1) vision_items: 스크랩 원본 추적용 컬럼 보강 ────────────────────────
alter table public.vision_items
  add column if not exists source_url text,
  add column if not exists source     text; -- 'scrap' | 'youtube' | 'instagram' | ...

-- ── 2) todos: 메모 / 원본 url 보강 ────────────────────────────────────
alter table public.todos
  add column if not exists note       text,
  add column if not exists source_url text;

-- ── 3) diary_entries: 신규 자유 일기 ──────────────────────────────────
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  content text not null default '',
  source_type text not null default 'free', -- 'free' | 'scrap'
  source_url text,
  source_label text,                        -- 출처 표시용(예: 스크랩 제목)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diary_entries enable row level security;

drop policy if exists "Users can view their own diary_entries"   on public.diary_entries;
drop policy if exists "Users can insert their own diary_entries" on public.diary_entries;
drop policy if exists "Users can update their own diary_entries" on public.diary_entries;
drop policy if exists "Users can delete their own diary_entries" on public.diary_entries;

create policy "Users can view their own diary_entries"
  on public.diary_entries for select using (auth.uid() = user_id);
create policy "Users can insert their own diary_entries"
  on public.diary_entries for insert with check (auth.uid() = user_id);
create policy "Users can update their own diary_entries"
  on public.diary_entries for update using (auth.uid() = user_id);
create policy "Users can delete their own diary_entries"
  on public.diary_entries for delete using (auth.uid() = user_id);

create index if not exists diary_entries_user_created_idx
  on public.diary_entries (user_id, created_at desc);

-- ── 4) Realtime publication 등록 (diary_entries 만 신규) ───────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'diary_entries'
  ) then
    alter publication supabase_realtime add table public.diary_entries;
  end if;
end $$;
