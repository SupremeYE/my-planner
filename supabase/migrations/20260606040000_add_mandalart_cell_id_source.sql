-- 만다라트 → 기간별 목표/할일 "보내기" Phase 1
-- 목적: 만다라트 칸(mandalart_cells)에서 만들어진 기간별 목표/할일에 출처를 기록.
-- 같은 칸을 중복으로 보내는 것을 방지하고, 보내서 생긴 항목에 "✦ 만다라트" 배지를
-- 표시하기 위한 단방향 FK.
--
-- 설계:
--  - 4개 테이블(annual_goals/monthly_goals/weekly_goals/todos)에 `mandalart_cell_id uuid NULL`
--  - FK → mandalart_cells(id) ON DELETE SET NULL — 셀이 지워져도 보내서 만든 목표/할일은 보존되고
--    배지만 사라진다.
--  - 인덱스: "이 셀에서 보낸 적 있는가?" 조회용 partial btree(null 제외)
--  - 진행률/Realtime 등은 변경 없음 (todos 는 이미 publication 등록 완료)
--  - 기존 행 영향 0 — 모든 컬럼 nullable

alter table public.annual_goals
  add column if not exists mandalart_cell_id uuid
    references public.mandalart_cells(id) on delete set null;
create index if not exists annual_goals_mandalart_cell_idx
  on public.annual_goals (mandalart_cell_id)
  where mandalart_cell_id is not null;

alter table public.monthly_goals
  add column if not exists mandalart_cell_id uuid
    references public.mandalart_cells(id) on delete set null;
create index if not exists monthly_goals_mandalart_cell_idx
  on public.monthly_goals (mandalart_cell_id)
  where mandalart_cell_id is not null;

alter table public.weekly_goals
  add column if not exists mandalart_cell_id uuid
    references public.mandalart_cells(id) on delete set null;
create index if not exists weekly_goals_mandalart_cell_idx
  on public.weekly_goals (mandalart_cell_id)
  where mandalart_cell_id is not null;

alter table public.todos
  add column if not exists mandalart_cell_id uuid
    references public.mandalart_cells(id) on delete set null;
create index if not exists todos_mandalart_cell_idx
  on public.todos (mandalart_cell_id)
  where mandalart_cell_id is not null;
