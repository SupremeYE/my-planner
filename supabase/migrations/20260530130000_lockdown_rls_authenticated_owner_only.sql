-- 단일 사용자 Auth 도입에 따른 전체 테이블 RLS 잠금
--
-- 배경: 앱이 공개 anon 키로 동작 → RLS가 꺼져 있거나 'public 전체허용' 정책이면
--       anon 키를 가진 누구나 모든 데이터를 읽기/수정/삭제 가능(실질 보호 0).
-- 조치: Supabase Auth 로그인(단일 사용자) 도입 후, 모든 앱 테이블 정책을
--       '로그인한 소유자 본인만'으로 통일. → 공개 anon 으로는 접근 불가.
--
-- owner uid = haon@planner.com 계정의 auth.users.id
--   (이메일이 바뀌어도 uid 는 불변이므로 uid 기준으로 고정)

DO $$
DECLARE
  uid constant text := 'e3b07a55-9c1f-4f3e-bb3c-2a0d9e7c4f1a';
  t text;
  pol record;
  tbls text[] := ARRAY[
    'book_quotes','books','food_records','habits','milestones','mood_records','projects',
    'review_records','self_care_records','timeline_logs','todos',
    'brainstorm_items','brainstorm_memos','daily_affirmations','events','habit_monthly_memos',
    'monthly_goals','monthly_reviews','period_records','tags','user_settings','weekly_goals','weekly_reviews',
    'annual_goals','daily_question','quarterly_goals','question_answers','question_pool','routines','moments'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- 기존 정책(전체허용/anon 포함) 모두 제거
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    -- 소유자(로그인한 본인)만 전체 권한
    EXECUTE format(
      'CREATE POLICY "owner only" ON public.%I FOR ALL TO authenticated USING (auth.uid() = %L) WITH CHECK (auth.uid() = %L)',
      t, uid, uid
    );
  END LOOP;
END $$;
