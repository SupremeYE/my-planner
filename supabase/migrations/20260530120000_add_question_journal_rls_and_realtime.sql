-- 질문일기 3테이블 RLS 정책 + Realtime publication 등록
--
-- 문제: question_pool / question_answers / daily_question 테이블이
--       RLS는 ENABLE 되어 있으나 정책(policy)이 하나도 없어
--       anon 키(앱이 사용하는 키)로 SELECT/INSERT/UPDATE/DELETE 가 전부 차단됨.
--       → 오늘의 질문이 배정/표시되지 않고, 커스텀 질문 추가도 적용 안 됨.
--
-- 해결: 앱의 단일 사용자 구조 컨벤션(routines "Allow all", moments anon * 정책)에 맞춰
--       public 역할에 ALL(true/true) 정책 추가. + Realtime 구독 대상 등록.

-- RLS 보장 (이미 켜져 있지만 명시)
ALTER TABLE public.question_pool    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_question   ENABLE ROW LEVEL SECURITY;

-- 기존 동명 정책 제거(재실행 안전성)
DROP POLICY IF EXISTS "Allow all question_pool"    ON public.question_pool;
DROP POLICY IF EXISTS "Allow all question_answers" ON public.question_answers;
DROP POLICY IF EXISTS "Allow all daily_question"   ON public.daily_question;

-- public 역할 전체 허용 정책
CREATE POLICY "Allow all question_pool"
  ON public.question_pool    FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all question_answers"
  ON public.question_answers FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all daily_question"
  ON public.daily_question   FOR ALL TO public USING (true) WITH CHECK (true);

-- Realtime publication 등록 (PC↔모바일 즉시 동기화) — 이미 등록된 경우 skip
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['question_pool','question_answers','daily_question']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
