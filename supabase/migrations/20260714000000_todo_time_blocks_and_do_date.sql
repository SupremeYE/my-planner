-- ⑬ Stage 3 — 진행중 자동 캐리오버: 날짜별 시간 블록 + do_* 귀속일
--
-- 배경: 할일 하나가 여러 날에 걸쳐 진행될 때 "그날 DO=그날 블록 / 총합=블록 합"을 모두
-- 정확히 표현하려면 날짜별 시간 블록이 필요하다. 라이브(가장 최근 추적한) 당일 블록은 기존
-- todos.do_* 컬럼에 남기고(dual-read 보존), 하루가 넘어가면 과거 블록을 이 테이블로 아카이브한다.
--   총 누적 = sum(todo_time_blocks.elapsed_sec) + todos.do_elapsed_sec(현재 do_date 블록)
--
-- 주의: 이 테이블은 이미 원격 DB에 존재할 수 있다(사전 세팅). 아래는 전부 멱등이라
-- 기존 환경에는 do_date 컬럼만 추가되고, 신규/로컬 환경에서는 테이블·정책·인덱스까지 생성된다.

-- ── 1) todo_time_blocks — 날짜별 아카이브 블록 ────────────────────────────────
create table if not exists public.todo_time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  todo_id text not null references public.todos(id) on delete cascade,
  date text not null,          -- 이 블록이 귀속되는 논리적 하루 'yyyy-MM-dd'
  start_time text,             -- "HH:mm"
  end_time text,               -- "HH:mm"
  elapsed_sec integer not null default 0,
  created_at timestamptz default now()
);

-- ── 2) todos.do_date — do_* 단일 블록이 귀속되는 논리적 날짜 ──────────────────
-- 캐리오버 시 do_* 는 시작일(todos.date)이 아니라 "가장 최근 추적한 날"에 귀속되므로 별도 저장.
-- 레거시 행은 null → 읽는 쪽에서 todos.date 로 폴백한다.
alter table public.todos add column if not exists do_date date;

-- ── 3) RLS: 소유자만 (기존 정책이 있으면 건드리지 않음) ───────────────────────
DO $$
DECLARE
  uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
BEGIN
  EXECUTE 'ALTER TABLE public.todo_time_blocks ENABLE ROW LEVEL SECURITY';
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='todo_time_blocks'
  ) THEN
    EXECUTE format(
      'CREATE POLICY "owner only" ON public.todo_time_blocks FOR ALL TO authenticated USING (auth.uid() = %L) WITH CHECK (auth.uid() = %L)',
      uid, uid
    );
  END IF;
END $$;

-- ── 4) 인덱스: (todo_id, date) 조회 + (user_id, date) 리포트 집계 ──────────────
create index if not exists todo_time_blocks_todo_date_idx on public.todo_time_blocks (todo_id, date);
create index if not exists todo_time_blocks_user_date_idx on public.todo_time_blocks (user_id, date);

-- ── 5) Realtime publication 등록 (이미 등록되어 있으면 skip) ───────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='todo_time_blocks'
  ) then
    execute 'alter publication supabase_realtime add table public.todo_time_blocks';
  end if;
end $$;
