-- 죽은 필드 정리 — todos.do_date 삭제 (기간 모델 Stage 2)
--
-- do_date(date): 전 40행 null, 코드 참조 0(조사 확정 — doDate/do_date 소비처 없음,
-- SendCellModal 의 todoDate 는 무관한 로컬 변수 = date 필드).
-- 시각 컬럼 plan_start/do_start(HH:mm)과도 무관한 완전 사망 컬럼.
-- 기간은 date(시작)+end_date(종료)로 표현하므로 do_date 는 정리한다.
--
-- 참고: started_date 는 이제 읽는 곳이 없지만(진행중은 date 시작일에서 파생),
--   실제 히스토리 2행을 보유하므로 파괴적 삭제 대신 유지한다.

ALTER TABLE public.todos DROP COLUMN IF EXISTS do_date;
