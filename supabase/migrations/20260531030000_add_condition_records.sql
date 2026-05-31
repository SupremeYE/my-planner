-- 컨디션 기록 (날짜당 1행)
-- 이 앱의 단일 사용자 구조에 맞춰 user_id 컬럼 없이 owner uid 하드코딩 RLS 사용.
CREATE TABLE IF NOT EXISTS public.condition_records (
  id text PRIMARY KEY,
  date text NOT NULL UNIQUE,                 -- yyyy-MM-dd
  stress smallint NOT NULL CHECK (stress BETWEEN 1 AND 5),
  symptoms text[] DEFAULT '{}',
  memo text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condition_records_date ON public.condition_records(date DESC);

DO $$
DECLARE
  uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
BEGIN
  EXECUTE 'ALTER TABLE public.condition_records ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "owner only" ON public.condition_records';
  EXECUTE format(
    'CREATE POLICY "owner only" ON public.condition_records FOR ALL TO authenticated USING (auth.uid() = %L) WITH CHECK (auth.uid() = %L)',
    uid, uid
  );
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.condition_records;
