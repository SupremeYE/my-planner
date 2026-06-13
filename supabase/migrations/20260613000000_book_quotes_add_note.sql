-- 독서 기록의 구절에 "내 생각"(개인 메모) 컬럼 추가
-- - nullable: 기존 행은 NULL, 새 구절은 선택 입력
-- - Realtime publication 은 기 등록 상태(이미 book_quotes 가 supabase_realtime 에 포함됨)
ALTER TABLE public.book_quotes
  ADD COLUMN IF NOT EXISTS note text;
