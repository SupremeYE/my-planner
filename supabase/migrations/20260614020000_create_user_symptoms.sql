-- 사용자 커스텀 증상 (컨디션 기록 칩 재사용용)
-- 단일 사용자 구조에 맞춰 user_id 컬럼 없이 owner uid 하드코딩 RLS 사용.
-- name_norm: 공백 정규화 + 소문자 — 중복 차단(같은 이름은 새로 만들지 않음)
CREATE TABLE IF NOT EXISTS public.user_symptoms (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_norm text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_symptoms_created ON public.user_symptoms(created_at DESC);

DO $$
DECLARE
  uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
BEGIN
  EXECUTE 'ALTER TABLE public.user_symptoms ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "owner only" ON public.user_symptoms';
  EXECUTE format(
    'CREATE POLICY "owner only" ON public.user_symptoms FOR ALL TO authenticated USING (auth.uid() = %L) WITH CHECK (auth.uid() = %L)',
    uid, uid
  );
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_symptoms;
