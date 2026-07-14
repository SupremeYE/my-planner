-- 할일 시간 블록(todo_time_blocks) — 상태축 Stage 3 (누적)
--
-- 목적: 시간 기록을 todos 행의 단일 블록(do_start/do_end/do_elapsed_sec 덮어쓰기)에서
--       경량 이벤트 테이블로 분리·적재한다. 타이머를 켤 때마다 한 줄씩 추가되어
--       "오늘 켠 만큼 DO + 날짜별 누적"이 가능해진다(덮어쓰기 아님).
--
-- 설계(단일 사용자 Auth 컨벤션 — walk_sessions/diary 패턴 동일):
--  - user_id DEFAULT auth.uid(), RLS 는 소유자 전용 select/insert/update/delete.
--  - todo_id 는 todos.id(text) FK, 할일 삭제 시 블록도 cascade 정리.
--  - date 는 작업한 날짜(yyyy-MM-dd) — todos.date(예정일)와 별개. 렌더는 이 date 기준.
--  - start_time/end_time 은 'HH:mm'(SQL 예약어 회피용 컬럼명), elapsed_sec 은 타이머 실측 초.
--  - dual-read: 기존 todos.do_* 컬럼은 유지(레거시/단순 케이스 계속 읽음). 신규 세션만 블록 적재.

create table if not exists public.todo_time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  todo_id text not null references public.todos(id) on delete cascade,
  date text not null,                       -- 작업한 날짜 yyyy-MM-dd
  start_time text,                          -- HH:mm
  end_time text,                            -- HH:mm
  elapsed_sec int not null default 0,       -- 타이머 실측 소요(초)
  created_at timestamptz not null default now()
);

alter table public.todo_time_blocks enable row level security;

drop policy if exists "Users can view their own todo_time_blocks"   on public.todo_time_blocks;
drop policy if exists "Users can insert their own todo_time_blocks" on public.todo_time_blocks;
drop policy if exists "Users can update their own todo_time_blocks" on public.todo_time_blocks;
drop policy if exists "Users can delete their own todo_time_blocks" on public.todo_time_blocks;

create policy "Users can view their own todo_time_blocks"
  on public.todo_time_blocks for select using (user_id = auth.uid());
create policy "Users can insert their own todo_time_blocks"
  on public.todo_time_blocks for insert with check (user_id = auth.uid());
create policy "Users can update their own todo_time_blocks"
  on public.todo_time_blocks for update using (user_id = auth.uid());
create policy "Users can delete their own todo_time_blocks"
  on public.todo_time_blocks for delete using (user_id = auth.uid());

create index if not exists todo_time_blocks_user_date_idx
  on public.todo_time_blocks (user_id, date);
create index if not exists todo_time_blocks_todo_idx
  on public.todo_time_blocks (todo_id);

-- Realtime publication 등록 (이미 등록된 경우 skip)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todo_time_blocks'
  ) then
    execute 'alter publication supabase_realtime add table public.todo_time_blocks';
  end if;
end $$;
