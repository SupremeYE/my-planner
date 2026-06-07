-- 음악 기록(music_records) 테이블 생성 — 문화 기록 > 음악 Stage 1
-- 목적: iTunes 검색으로 곡을 골라 무드·메모와 함께 기록한다.
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션에 맞춤, culture_records 패턴 동일):
--  - user_id 는 DEFAULT auth.uid() 로 자동 채운다. 클라이언트(db.ts)가 user_id 를
--    따로 보내지 않아도 INSERT 시점의 로그인 사용자가 들어간다.
--  - RLS 는 "로그인한 본인(소유자)만" 정책으로 select/insert/update/delete 통일.
--  - Realtime: PC↔모바일 즉시 반영 원칙에 따라 supabase_realtime publication 에 등록.

create table if not exists public.music_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  track_title text not null,
  artist text not null,
  album text,
  artwork_url text,
  release_year int,
  itunes_track_id bigint,          -- 중복 추가 방지용 (iTunes trackId)
  preview_url text,                -- iTunes 30초 미리듣기 URL
  mood text[] default '{}',        -- 무드·상황 태그(복수)
  genre text,
  memo text,
  listen_url text,                 -- 비우면 제목으로 자동 검색 (Stage 2)
  stickers jsonb default '[]'      -- Stage 3에서 사용 (지금은 컬럼만)
);

alter table public.music_records enable row level security;

drop policy if exists "Users can view their own records"   on public.music_records;
drop policy if exists "Users can insert their own records" on public.music_records;
drop policy if exists "Users can update their own records" on public.music_records;
drop policy if exists "Users can delete their own records" on public.music_records;

create policy "Users can view their own records"
  on public.music_records for select
  using (auth.uid() = user_id);

create policy "Users can insert their own records"
  on public.music_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own records"
  on public.music_records for update
  using (auth.uid() = user_id);

create policy "Users can delete their own records"
  on public.music_records for delete
  using (auth.uid() = user_id);

create index if not exists music_records_user_created_idx on public.music_records (user_id, created_at desc);

-- 같은 사용자가 동일한 iTunes 곡을 중복 추가하지 못하도록 (수동 입력=null 은 예외)
create unique index if not exists music_records_user_itunes_uidx
  on public.music_records (user_id, itunes_track_id)
  where itunes_track_id is not null;

-- Realtime publication 등록 (이미 등록된 경우 skip)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'music_records'
  ) then
    alter publication supabase_realtime add table public.music_records;
  end if;
end $$;
