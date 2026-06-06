-- 기간별 목표 ↔ 할일 연결 — Phase 1
-- 목적: 주간 목표(weekly_goals)에 할일(todos)을 연결해, 주간%/월간%/연간% 자동 롤업의
-- 기반을 만든다. 별도 join 테이블은 만들지 않고 todos.weekly_goal_id 한 컬럼만 추가
-- — 한 할일은 하나의 주간 목표에만 연결된다는 정책.
--
-- 설계:
--  - nullable: 기존 할일/일정/미지정 할일 영향 없음 (대다수는 null 유지)
--  - FK: weekly_goals.id (text) → ON DELETE SET NULL — 주간 목표 삭제 시 할일은 보존되고 연결만 끊김
--  - 인덱스: 주간 카드에서 "이 주간에 연결된 todos" 조회 자주 일어남 → btree (weekly_goal_id) (null 행 제외)
--  - 진행률(주간/월간/연간 롤업)은 클라이언트 계산, DB 트리거 없음
--  - Realtime: todos 는 이미 publication 등록되어 있으므로 추가 작업 없음

alter table public.todos
  add column if not exists weekly_goal_id text
    references public.weekly_goals(id) on delete set null;

create index if not exists todos_weekly_goal_idx
  on public.todos (weekly_goal_id)
  where weekly_goal_id is not null;
