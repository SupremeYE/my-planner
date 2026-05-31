-- events 테이블을 앱 코드(src/api/events.ts)가 기대하는 스키마로 정렬
--
-- 배경: 운영 DB의 events 테이블에 옛 스키마(date/start_time/end_time)만 존재하고
--       코드가 사용하는 start_at/end_at/is_all_day/repeat_* 등 컬럼이 없어서
--       GET /events 요청이 400 (column events.start_at does not exist)으로 실패했다.
--       그 결과 일정 추가/조회가 전혀 동작하지 않고(일별·캘린더에 미표시),
--       store 초기 로딩의 Promise.all 이 events fetch 실패로 reject 되어
--       태그 등 다른 상태까지 화면에 반영되지 않는 부작용이 있었다.
--
-- 조치: 코드가 기대하는 컬럼을 추가하고, 코드가 더 이상 채우지 않는 date 의
--       NOT NULL 제약을 완화한다. (events 테이블은 0행이라 데이터 손실 없음)
-- 비고: start_at/end_at 는 코드가 'yyyy-MM-ddTHH:mm:ss' 문자열로 다루므로 text 로 둔다.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_all_day boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_at text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_at text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS repeat_type text DEFAULT 'none';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS repeat_end_date text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS alert_minutes integer;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.events ALTER COLUMN date DROP NOT NULL;
