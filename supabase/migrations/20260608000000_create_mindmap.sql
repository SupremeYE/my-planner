-- 마인드맵 코어 — Phase 5-0
-- 목적: 스크랩(영감) 한 건마다 딸린 마인드맵. 루트 1개 + 무한 가지(parent_id 자기참조).
--       노드는 여러 스크랩에 복수로 연결될 수 있다(mindmap_node_scraps 다대다).
--
-- 설계 메모:
--  - 단일 사용자 Auth 컨벤션(vision_*, scraps, mandalart_* 패턴)에 맞춤.
--    user_id 는 DEFAULT auth.uid() 로 자동 충전 → 클라이언트가 보내지 않는다.
--  - mindmap_nodes.scrap_id  = 이 맵이 속한 스크랩(루트 포함 전 노드가 동일 scrap_id).
--  - mindmap_nodes.parent_id = 루트는 NULL, 그 외엔 부모 노드. ON DELETE CASCADE 로 서브트리 통삭제.
--  - dir 은 루트 직속 가지에만 의미('right'|'left'|'up'|'down'). 그 아래는 부모 방향 상속(클라이언트 계산).
--  - mindmap_node_scraps: 노드 1개가 여러 스크랩에 연결. (node_id, scrap_id) 복합 PK 로 중복 방지.
--  - RLS: 본인 데이터만. 인덱스 mindmap_nodes(scrap_id),(parent_id).
--  - Realtime: 두 테이블 모두 supabase_realtime publication 등록(PC↔모바일 즉시 반영).

-- ── 1) mindmap_nodes ───────────────────────────────────────────────────
create table if not exists public.mindmap_nodes (
  id uuid primary key default gen_random_uuid(),
  scrap_id uuid not null references public.scraps(id) on delete cascade,
  parent_id uuid references public.mindmap_nodes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null default '',
  dir text check (dir in ('right', 'left', 'up', 'down')),  -- NULL = 루트 또는 상속
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mindmap_nodes_scrap_idx
  on public.mindmap_nodes (scrap_id);
create index if not exists mindmap_nodes_parent_idx
  on public.mindmap_nodes (parent_id);

alter table public.mindmap_nodes enable row level security;

drop policy if exists "Users can view their own mindmap_nodes"   on public.mindmap_nodes;
drop policy if exists "Users can insert their own mindmap_nodes" on public.mindmap_nodes;
drop policy if exists "Users can update their own mindmap_nodes" on public.mindmap_nodes;
drop policy if exists "Users can delete their own mindmap_nodes" on public.mindmap_nodes;

create policy "Users can view their own mindmap_nodes"
  on public.mindmap_nodes for select using (auth.uid() = user_id);
create policy "Users can insert their own mindmap_nodes"
  on public.mindmap_nodes for insert with check (auth.uid() = user_id);
create policy "Users can update their own mindmap_nodes"
  on public.mindmap_nodes for update using (auth.uid() = user_id);
create policy "Users can delete their own mindmap_nodes"
  on public.mindmap_nodes for delete using (auth.uid() = user_id);

-- ── 2) mindmap_node_scraps (노드 ↔ 스크랩 다대다) ───────────────────────
create table if not exists public.mindmap_node_scraps (
  node_id uuid not null references public.mindmap_nodes(id) on delete cascade,
  scrap_id uuid not null references public.scraps(id) on delete cascade,
  primary key (node_id, scrap_id)
);

create index if not exists mindmap_node_scraps_scrap_idx
  on public.mindmap_node_scraps (scrap_id);

alter table public.mindmap_node_scraps enable row level security;

drop policy if exists "Users can view their own mindmap_node_scraps"   on public.mindmap_node_scraps;
drop policy if exists "Users can insert their own mindmap_node_scraps" on public.mindmap_node_scraps;
drop policy if exists "Users can delete their own mindmap_node_scraps" on public.mindmap_node_scraps;

-- 소속 노드 소유자만 (EXISTS 기반 — mandalart_cells 패턴)
create policy "Users can view their own mindmap_node_scraps"
  on public.mindmap_node_scraps for select
  using (exists (select 1 from public.mindmap_nodes n where n.id = mindmap_node_scraps.node_id and n.user_id = auth.uid()));
create policy "Users can insert their own mindmap_node_scraps"
  on public.mindmap_node_scraps for insert
  with check (exists (select 1 from public.mindmap_nodes n where n.id = mindmap_node_scraps.node_id and n.user_id = auth.uid()));
create policy "Users can delete their own mindmap_node_scraps"
  on public.mindmap_node_scraps for delete
  using (exists (select 1 from public.mindmap_nodes n where n.id = mindmap_node_scraps.node_id and n.user_id = auth.uid()));

-- ── 3) Realtime publication ─────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mindmap_nodes'
  ) then
    alter publication supabase_realtime add table public.mindmap_nodes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mindmap_node_scraps'
  ) then
    alter publication supabase_realtime add table public.mindmap_node_scraps;
  end if;
end $$;
