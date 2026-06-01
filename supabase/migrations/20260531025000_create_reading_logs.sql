-- 독서 진행 이력(reading_logs) 테이블 생성
-- 목적: books.current_page 가 바뀔 때마다 그 시점의 누적 페이지를 스냅샷으로 남겨
--       "오늘 몇 페이지 읽음" 같은 데일리/책별 리포트를 가능하게 한다.
--
-- 설계 메모:
--  - book_id 는 books.id 가 nanoid 기반 text PK 이므로 text 로 정의한다.
--    (스펙의 uuid 가 아니라 실제 books.id 타입(text)에 맞춤 — FK 타입 불일치 방지)
--  - user_id 는 DEFAULT auth.uid() 로 자동 채운다. 앱은 단일 사용자 Auth 세션으로 동작하므로
--    클라이언트가 user_id 를 따로 보내지 않아도 INSERT 시점의 로그인 사용자가 들어간다.
--  - RLS 는 기존 lockdown 마이그레이션의 "owner only / FOR ALL / TO authenticated" 패턴을 따른다.

create table if not exists public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  page int not null,
  date text not null,              -- yyyy-MM-dd (다른 테이블의 date 컬럼과 동일한 text 패턴)
  duration_minutes int,            -- 향후 "독서 30분" 형태 입력용
  note text,
  created_at timestamptz not null default now()
);

-- 인덱스
create index if not exists reading_logs_user_date_idx on public.reading_logs (user_id, date);  -- 데일리 리포트 쿼리용
create index if not exists reading_logs_book_date_idx on public.reading_logs (book_id, date);   -- 책별 이력 조회용

-- RLS: 로그인한 본인(소유자)만 select/insert/update/delete 가능
alter table public.reading_logs enable row level security;

drop policy if exists "reading_logs owner only" on public.reading_logs;
create policy "reading_logs owner only" on public.reading_logs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime: PC↔모바일 즉시 반영 원칙에 따라 publication 에 등록
alter publication supabase_realtime add table public.reading_logs;
