-- 프로젝트 ↔ 목표 연결 + 할일 ↔ 마일스톤 연결 — Phase 1
-- 목적:
--  - 프로젝트는 "실행" 메뉴로 분리하되, 목표(연간/분기/월간)와 단방향으로 연결한다.
--  - 마일스톤은 할일을 묶어 진행률을 자동 산출하는 단위가 된다.
--    (todos.milestone_id 한 컬럼만 추가 — join 테이블 없이 일대다)
--
-- 설계:
--  - projects.goal_kind: 'annual' | 'quarterly' | 'monthly' (CHECK)
--    nullable — 연결 없는 프로젝트는 NULL.
--  - projects.goal_id: 텍스트 PK(annual_goals/quarterly_goals/monthly_goals)를 가리키는 text.
--    이종 테이블 참조라 PG FK 는 못 걸지만, 클라이언트가 goal_kind 와 함께 해석한다.
--    삭제 시 정합성: 클라이언트가 goal 삭제 후 연결 해제 책임.
--  - todos.milestone_id: milestones.id (text) FK ON DELETE SET NULL
--    마일스톤 삭제 시 할일은 보존되고 연결만 끊김.
--  - 인덱스: 빈번한 조회용 partial btree(null 제외)
--  - Realtime: todos/projects 모두 publication 이미 등록 → 추가 작업 없음
--  - 기존 행 영향 0 (모든 컬럼 nullable)

alter table public.projects
  add column if not exists goal_kind text
    check (goal_kind is null or goal_kind in ('annual','quarterly','monthly')),
  add column if not exists goal_id text;

create index if not exists projects_goal_idx
  on public.projects (goal_kind, goal_id)
  where goal_id is not null;

alter table public.todos
  add column if not exists milestone_id text
    references public.milestones(id) on delete set null;

create index if not exists todos_milestone_idx
  on public.todos (milestone_id)
  where milestone_id is not null;
