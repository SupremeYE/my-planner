-- events 테이블에 실적(actual/DO) 시각 컬럼 추가 — EVT-actual Stage 1
--
-- 배경: 일정(Event)도 할일처럼 "실제 한 시간(actual)"을 가질 수 있게 한다.
--       계획(start_at/end_at)과 별개로, 실제로 실행한 시각을 do_start/do_end 에 담는다.
--       (예: 계획 07:00–08:00 → 실제 21:00–22:00)
-- 명명: 할일과 동일 규칙(todos.do_start/do_end) → 드리프트 방지.
-- v1 범위: 일정 타이머는 범위 밖이므로 do_elapsed_sec 는 추가하지 않는다(나중에 붙여도 명명 정합).
-- 안전성: 둘 다 NULL 허용·default 없음 → 기존 행은 do_start/do_end 가 모두 NULL 로 유지(무영향).
--         actual 없으면(NULL) 이후 Stage 에서 DO 블록을 그리지 않는다(정직).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS do_start text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS do_end text;

COMMENT ON COLUMN public.events.do_start IS
  '일정 실제(actual) 시작 시각(HH:mm). NULL = 실적 없음. 계획은 start_at 유지. Realtime events 기등록.';
COMMENT ON COLUMN public.events.do_end IS
  '일정 실제(actual) 종료 시각(HH:mm). NULL = 실적 없음. 계획은 end_at 유지.';
