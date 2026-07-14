-- 반복(recurrence) 통합 스펙용 flat 컬럼 추가 (②b Stage 1)
--
-- 배경: 할일(todos)과 일정(events)이 각자 다른 반복 시스템을 갖고 있었고,
--       매일/평일/주말/매주 특정요일/매월/매년/N일마다(iOS 미리알림 수준)를
--       공용 RecurrenceSpec(src/lib/recurrence.ts)으로 일원화한다.
--
-- 설계(Stage 0 승인):
--  - flat 컬럼 가산 방식(하온 전체 패턴 유지). JSONB 미사용.
--  - 레거시 컬럼(todos.recurrence_rule, events.repeat_type)은 삭제하지 않고 유지 →
--    앱이 dual-read 로 정규화(개발/로컬 데이터 보호). NOT NULL/CHECK 로 강제하지 않음.
--  - byday: todos 는 기존 recurrence_days(int[]) 재사용, events 는 신규 recurrence_byday.
--
-- 컬럼(공통):
--   recurrence_freq      text     'daily'|'weekly'|'monthly'|'yearly'. null 이면 비반복/레거시.
--   recurrence_interval  int      N — 매 N 주기마다. 기본 1.
--   recurrence_preset    text     'weekday'|'weekend' (UI 편의, weekly 전용).

-- ── todos ────────────────────────────────────────────────────────────────────
ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS recurrence_freq text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_preset text;

-- ── events ───────────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence_freq text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_byday integer[],
  ADD COLUMN IF NOT EXISTS recurrence_preset text;

-- 과거 마이그레이션(20260412010000)이 남겼을 수 있는 repeat_type CHECK 제거.
-- 통합 후 반복 종류는 recurrence_freq 로 표현되며 repeat_type 은 레거시 읽기 전용.
-- 제약이 남아 있으면 프레시 재적용 시 신규 값 확장을 막을 수 있어 방어적으로 drop.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_repeat_type_check;

-- Realtime: todos/events 모두 supabase_realtime publication 에 이미 등록됨 → 추가 작업 없음.
