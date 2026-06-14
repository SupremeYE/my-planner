-- events 테이블에 완료 상태(completed) 컬럼 추가
--
-- 배경: 일정도 "했다/안 했다" 체크가 가능하도록 한다.
--       기존 행은 모두 default false 가 된다. NOT NULL + default 로 안전하게 추가.
-- 비고: 반복 일정은 마스터 행 하나만 가지므로, 한 occurrence 토글 시
--       전체 시리즈가 함께 토글된다(현재 일정 모델의 동작 그대로).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
