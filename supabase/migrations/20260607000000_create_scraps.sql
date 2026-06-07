-- 스크랩 / 영감 보관함 — Stage 0
-- 목적: 유튜브/인스타/스레드/웹 링크를 모아두는 영감 보관함.
--       스크랩 본체(scraps) + 스크랩에 쌓이는 짧은 글 기록(scrap_notes 1:N).
--
-- 설계 메모:
--  - 단일 사용자 Auth 컨벤션(vision_*, culture_records, moments 패턴)에 맞춤.
--    user_id 는 DEFAULT auth.uid() 로 자동 충전 → 클라이언트가 보내지 않는다.
--  - scrap_notes.scrap_id ON DELETE CASCADE — 부모 스크랩 삭제 시 노트도 함께 삭제.
--  - RLS: 본인 행만 select/insert/update/delete.
--  - 인덱스:
--      scraps(user_id, created_at desc)        — 보관함 목록 정렬용
--      scrap_notes(scrap_id, created_at)       — 스크랩 상세 노트 타임라인용
--  - Realtime: 두 테이블 모두 supabase_realtime publication 등록.

-- ── 1) scraps ──────────────────────────────────────────────────────────
create table if not exists public.scraps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url text,
  source text,                            -- 'youtube' | 'instagram' | 'threads' | 'web'
  title text,
  thumbnail_url text,
  comment text,                           -- 한 줄 코멘트
  tags text[] not null default '{}',
  status text not null default 'unread',  -- 'unread' | 'revisit' | 'done'
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scraps enable row level security;

drop policy if exists "Users can view their own scraps"   on public.scraps;
drop policy if exists "Users can insert their own scraps" on public.scraps;
drop policy if exists "Users can update their own scraps" on public.scraps;
drop policy if exists "Users can delete their own scraps" on public.scraps;

create policy "Users can view their own scraps"
  on public.scraps for select using (auth.uid() = user_id);
create policy "Users can insert their own scraps"
  on public.scraps for insert with check (auth.uid() = user_id);
create policy "Users can update their own scraps"
  on public.scraps for update using (auth.uid() = user_id);
create policy "Users can delete their own scraps"
  on public.scraps for delete using (auth.uid() = user_id);

create index if not exists scraps_user_created_idx
  on public.scraps (user_id, created_at desc);

-- ── 2) scrap_notes ─────────────────────────────────────────────────────
create table if not exists public.scrap_notes (
  id uuid primary key default gen_random_uuid(),
  scrap_id uuid not null references public.scraps(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.scrap_notes enable row level security;

drop policy if exists "Users can view their own scrap_notes"   on public.scrap_notes;
drop policy if exists "Users can insert their own scrap_notes" on public.scrap_notes;
drop policy if exists "Users can update their own scrap_notes" on public.scrap_notes;
drop policy if exists "Users can delete their own scrap_notes" on public.scrap_notes;

create policy "Users can view their own scrap_notes"
  on public.scrap_notes for select using (auth.uid() = user_id);
create policy "Users can insert their own scrap_notes"
  on public.scrap_notes for insert with check (auth.uid() = user_id);
create policy "Users can update their own scrap_notes"
  on public.scrap_notes for update using (auth.uid() = user_id);
create policy "Users can delete their own scrap_notes"
  on public.scrap_notes for delete using (auth.uid() = user_id);

create index if not exists scrap_notes_scrap_created_idx
  on public.scrap_notes (scrap_id, created_at);

-- ── 3) Realtime publication ────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scraps'
  ) then
    alter publication supabase_realtime add table public.scraps;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scrap_notes'
  ) then
    alter publication supabase_realtime add table public.scrap_notes;
  end if;
end $$;
