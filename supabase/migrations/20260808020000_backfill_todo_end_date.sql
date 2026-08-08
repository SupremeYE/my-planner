-- 할일 기간(period) 모델 이행 — 기간 기반 "진행중" 전환 Stage 1
--
-- 배경: 과거 status(inProgress)가 "진행중 표시"와 "오늘 화면 이월 자격"을 겸해,
--  완료(→done)·진행중 해제(→active) 어느 쪽이든 이월 브릿지가 끊기며 할일이
--  오늘 화면에서 사라졌다. 이를 "기간(시작~종료) + 미완료"에서 진행중을 파생하는
--  모델로 전환한다.
--
-- 스키마: 새 컬럼을 만들지 않는다.
--  - date      = 시작일(start). 기존 앵커 그대로(rename 없음 — 참조가 방대).
--  - end_date  = 종료일(end). TodoModal "멀티데이 종료일" UI로 이미 왕복하던
--                컬럼을 기간 종료의 단일 출처로 승격한다(그간 읽는 뷰가 없었음).
--
-- 이행: 단일 날짜 할일(end_date 미설정)은 시작=종료로 채운다. 기존 다중일 2건
--  (end_date > date)은 보존, date=null 인박스 항목은 기간 없음으로 그대로 둔다.
--  파생 규칙(Stage 2 코드): date <= 오늘 <= end_date AND status<>done → "진행중",
--  end_date < 오늘 AND status<>done → "늦음". 둘 다 오늘 화면에 계속 노출한다.

COMMENT ON COLUMN public.todos.end_date IS
  '할일 기간 종료일(yyyy-MM-dd). date=시작일과 쌍. 단일 날짜면 date와 동일. 기간+미완료에서 "진행중"/"늦음"을 파생. Realtime todos 기등록.';

-- 단일 날짜 할일 백필: 시작=종료 (37행 예상 — date 있으나 end_date 미설정)
UPDATE public.todos
  SET end_date = date
  WHERE end_date IS NULL
    AND date IS NOT NULL;
