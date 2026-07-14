-- 할일 이월(carryover) 기준일 — 상태축 Stage 4
--
-- 목적: 할일이 처음 '진행중(inProgress)'이 된 날짜를 기록한다.
--  - "N일째 진행중" 표시(오늘 - started_date + 1)
--  - 미완 진행중 자동 이월("이어서 하기") 기준
--
-- started_date 는 상태가 처음 inProgress 로 바뀔 때(타이머 시작 또는 수동) 채워지고,
-- 이후 유지된다(완료돼도 기록으로 남김 — 이월은 status 로 제어).

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS started_date text;

COMMENT ON COLUMN public.todos.started_date IS
  '할일이 처음 진행중이 된 날짜(yyyy-MM-dd). "N일째" 및 이월 기준. Realtime todos 기등록.';
