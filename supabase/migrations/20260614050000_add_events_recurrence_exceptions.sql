-- 반복 일정의 한 회차만 완료(또는 개별 변경)할 수 있도록 events 테이블에 예외 행 컬럼 추가
--
-- 배경: 반복 일정의 한 occurrence 를 완료해도 전체 시리즈가 함께 토글되는 것을 막아야 한다.
--       할일(todos)이 이미 쓰는 반복 예외 구체화 패턴(parent + occurrence + is_exception)을
--       events 에 동일하게 포팅한다. 새 테이블을 만들지 않는다.
-- 컬럼:
--   - parent_event_id  text       반복 마스터의 id. 예외 행에만 채움, 평소 null.
--                                  마스터가 삭제되면 예외도 cascade 로 함께 정리.
--                                  (events.id 가 text 타입이라 일치시킴)
--   - occurrence_date  text       예외 행이 가리키는 회차 날짜('yyyy-MM-dd'). 평소 null.
--                                  (이 앱은 날짜를 모두 text 'yyyy-MM-dd' 로 다룸)
--   - is_exception     boolean    예외 행 여부. default false, not null.
--
-- 기존 행: is_exception=false, parent_event_id/occurrence_date null 로 채워진다.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS parent_event_id text REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS occurrence_date text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_exception boolean NOT NULL DEFAULT false;

-- 예외 행 조회 인덱스 (펼침 시 parent + date 매칭)
CREATE INDEX IF NOT EXISTS idx_events_parent_occurrence
  ON public.events(parent_event_id, occurrence_date)
  WHERE is_exception = true;
