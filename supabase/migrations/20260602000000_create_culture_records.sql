-- 문화 기록(culture_records) 테이블 생성 — Stage 1
-- 목적: 영화/드라마/예능/유튜브 등 시청 콘텐츠 기록.
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션에 맞춤):
--  - user_id 는 DEFAULT auth.uid() 로 자동 채운다. 클라이언트(db.ts)가 user_id 를
--    따로 보내지 않아도 INSERT 시점의 로그인 사용자가 들어간다. (reading_logs 패턴 동일)
--  - RLS 는 "로그인한 본인(소유자)만" 정책으로 select/insert/update/delete 통일.
--  - Realtime: PC↔모바일 즉시 반영 원칙에 따라 supabase_realtime publication 에 등록.

create table if not exists public.culture_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  platform text not null check (platform in ('netflix','youtube','disney_plus','coupang_play','tving','watcha','theater','other')),
  content_type text not null check (content_type in ('movie','drama','variety','documentary','anime','youtube_video','lecture','other')),
  url text,
  thumbnail_url text,
  status text not null default 'completed' check (status in ('watchlist','watching','completed','dropped')),
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  review text,
  insight text,
  tags text[] default '{}',
  watched_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.culture_records enable row level security;

drop policy if exists "Users can view their own records"   on public.culture_records;
drop policy if exists "Users can insert their own records" on public.culture_records;
drop policy if exists "Users can update their own records" on public.culture_records;
drop policy if exists "Users can delete their own records" on public.culture_records;

create policy "Users can view their own records"
  on public.culture_records for select
  using (auth.uid() = user_id);

create policy "Users can insert their own records"
  on public.culture_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own records"
  on public.culture_records for update
  using (auth.uid() = user_id);

create policy "Users can delete their own records"
  on public.culture_records for delete
  using (auth.uid() = user_id);

create index if not exists culture_records_user_created_idx on public.culture_records (user_id, created_at desc);
create index if not exists culture_records_user_status_idx  on public.culture_records (user_id, status);

-- Realtime publication 등록 (이미 등록된 경우 skip)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'culture_records'
  ) then
    alter publication supabase_realtime add table public.culture_records;
  end if;
end $$;
