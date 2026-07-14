-- 할일 상태 축(status axis) 문서화 (상태축 Stage 2)
--
-- 배경: 할일에 '진행중(inProgress)' 상태를 1급 상태로 도입한다.
--  - 타이머 시작 → inProgress (one-way)
--  - 타이머 정지 → inProgress 유지 (시간만 기록, 완료 아님)
--  - 수동 진행중 입구(컨텍스트 메뉴), 자정 타이머 자동 일시정지
--  - 시간 없는 진행중은 DO 타임라인에서 제외(doStart/doEnd 없으면 렌더 안 됨)
--
-- 스키마: todos.status 는 이미 text(기본 'active')이며 CHECK 제약이 없어
--         'inProgress' 값이 그대로 저장된다. 별도 컬럼/제약 추가 없이 문서화만 한다.
--         (코드베이스의 constraint-averse 패턴 유지 — 임의 CHECK 로 기존 행을 깨지 않음)
-- 허용 상태값: active | inProgress | done | cancelled | snoozed | backlog
--
-- Realtime: todos 는 supabase_realtime publication 에 이미 등록됨 → 추가 작업 없음.

COMMENT ON COLUMN public.todos.status IS
  '할일 상태: active(예정) | inProgress(진행중) | done(완료) | cancelled(취소) | snoozed(미룸) | backlog. 타이머 시작→inProgress, 정지→inProgress 유지, 완료→done.';
