-- 메모(memos) 테이블 생성 — 일간 리디자인 Stage 5 "메모 페이지 신설"
-- 목적: 자유 메모를 독립 엔티티로. 태그 부여 / "확인" 처리 / 날짜 귀속(일간 "오늘 메모" 칩 집약).
--
-- 설계 메모(단일 사용자 Auth 컨벤션, music_records/culture_records 패턴 동일):
--  - user_id 는 DEFAULT auth.uid() 로 자동. 클라이언트(db.ts)는 user_id 미전송.
--  - RLS 는 "로그인 본인(소유자)만" select/insert/update/delete 통일.
--  - date 는 "귀속 논리 날짜". 클라가 getLogicalToday() 로 명시 전송(하루 경계 단일 소스 준수);
--    DB DEFAULT(KST 오늘)는 안전망일 뿐이다.
--  - tags 는 store 의 Tag.id 배열(할일 tags 와 동일 컨벤션).
--  - Realtime: PC↔모바일 즉시 반영 원칙에 따라 supabase_realtime publication 에 등록.

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content text not null default '',
  date date default ((now() at time zone 'Asia/Seoul')::date),  -- 귀속 날짜(일간 칩 집약 키)
  tags text[] default '{}',                                     -- 태그 id 배열(store tags 참조)
  confirmed boolean not null default false                      -- "확인" 처리 여부
);

alter table public.memos enable row level security;

drop policy if exists "Users can view their own memos"   on public.memos;
drop policy if exists "Users can insert their own memos" on public.memos;
drop policy if exists "Users can update their own memos" on public.memos;
drop policy if exists "Users can delete their own memos" on public.memos;

create policy "Users can view their own memos"
  on public.memos for select
  using (auth.uid() = user_id);

create policy "Users can insert their own memos"
  on public.memos for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own memos"
  on public.memos for update
  using (auth.uid() = user_id);

create policy "Users can delete their own memos"
  on public.memos for delete
  using (auth.uid() = user_id);

create index if not exists memos_user_date_idx      on public.memos (user_id, date desc);
create index if not exists memos_user_confirmed_idx on public.memos (user_id, confirmed);

-- Realtime publication 등록 (이미 등록된 경우 skip)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memos'
  ) then
    alter publication supabase_realtime add table public.memos;
  end if;
end $$;
