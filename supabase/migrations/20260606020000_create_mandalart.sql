-- 만다라트(Mandalart) — Phase 1
-- 목적: /goals 페이지 안의 새 모드. "핵심 목표 → 세부 목표 8 → 행동 8" 트리 구조.
--
-- 설계 메모:
--  - 단일 사용자 Auth 컨벤션(vision_*, culture_records, moments 패턴)에 맞춤.
--    user_id 는 DEFAULT auth.uid() 로 자동 충전 → 클라이언트가 보내지 않는다.
--  - mandalart_boards: 핵심 목표 = title.
--  - mandalart_cells: parent_id NULL = 세부(0~7), parent_id=세부id = 행동(0~7).
--    position 은 board+parent 범위 내 0~7. 같은 (board_id, parent_id, position) 중복 방지.
--  - 진행률 계산은 클라이언트에서 (행동 완료 / 행동 전체) 로 산출 — DB 트리거 없음.
--  - 기본 보드 1개 시드는 클라이언트(db.mandalartBoards.fetchAll 첫 호출 빈 결과 시)에서 한다.

-- ── 1) mandalart_boards ────────────────────────────────────────────────
create table if not exists public.mandalart_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.mandalart_boards enable row level security;

drop policy if exists "Users can view their own mandalart_boards"   on public.mandalart_boards;
drop policy if exists "Users can insert their own mandalart_boards" on public.mandalart_boards;
drop policy if exists "Users can update their own mandalart_boards" on public.mandalart_boards;
drop policy if exists "Users can delete their own mandalart_boards" on public.mandalart_boards;

create policy "Users can view their own mandalart_boards"
  on public.mandalart_boards for select using (auth.uid() = user_id);
create policy "Users can insert their own mandalart_boards"
  on public.mandalart_boards for insert with check (auth.uid() = user_id);
create policy "Users can update their own mandalart_boards"
  on public.mandalart_boards for update using (auth.uid() = user_id);
create policy "Users can delete their own mandalart_boards"
  on public.mandalart_boards for delete using (auth.uid() = user_id);

create index if not exists mandalart_boards_user_sort_idx
  on public.mandalart_boards (user_id, sort_order asc, created_at asc);

-- ── 2) mandalart_cells ─────────────────────────────────────────────────
create table if not exists public.mandalart_cells (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.mandalart_boards(id) on delete cascade,
  parent_id uuid references public.mandalart_cells(id) on delete cascade,
  position int not null check (position between 0 and 7),
  content text not null default '',
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

-- 동일 부모 안에서 position 중복 방지
create unique index if not exists mandalart_cells_board_parent_position_uniq
  on public.mandalart_cells (board_id, coalesce(parent_id::text, ''), position);

create index if not exists mandalart_cells_board_idx
  on public.mandalart_cells (board_id);
create index if not exists mandalart_cells_parent_idx
  on public.mandalart_cells (parent_id);

alter table public.mandalart_cells enable row level security;

drop policy if exists "Users can view their own mandalart_cells"   on public.mandalart_cells;
drop policy if exists "Users can insert their own mandalart_cells" on public.mandalart_cells;
drop policy if exists "Users can update their own mandalart_cells" on public.mandalart_cells;
drop policy if exists "Users can delete their own mandalart_cells" on public.mandalart_cells;

-- 소속 보드 소유자만 (EXISTS 기반)
create policy "Users can view their own mandalart_cells"
  on public.mandalart_cells for select
  using (exists (select 1 from public.mandalart_boards b where b.id = mandalart_cells.board_id and b.user_id = auth.uid()));
create policy "Users can insert their own mandalart_cells"
  on public.mandalart_cells for insert
  with check (exists (select 1 from public.mandalart_boards b where b.id = mandalart_cells.board_id and b.user_id = auth.uid()));
create policy "Users can update their own mandalart_cells"
  on public.mandalart_cells for update
  using (exists (select 1 from public.mandalart_boards b where b.id = mandalart_cells.board_id and b.user_id = auth.uid()));
create policy "Users can delete their own mandalart_cells"
  on public.mandalart_cells for delete
  using (exists (select 1 from public.mandalart_boards b where b.id = mandalart_cells.board_id and b.user_id = auth.uid()));

-- ── 3) Realtime publication ─────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mandalart_boards'
  ) then
    alter publication supabase_realtime add table public.mandalart_boards;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mandalart_cells'
  ) then
    alter publication supabase_realtime add table public.mandalart_cells;
  end if;
end $$;
