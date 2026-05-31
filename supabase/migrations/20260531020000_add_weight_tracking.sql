-- 몸무게 트래킹: 체중 기록 + 목표
-- 이 앱의 단일 사용자 구조에 맞춰 기존 테이블과 동일하게
-- user_id 컬럼 없이 owner uid 하드코딩 RLS 패턴을 사용한다.

-- 체중 기록 (날짜당 1행)
CREATE TABLE IF NOT EXISTS public.weight_records (
  id text PRIMARY KEY,
  date text NOT NULL UNIQUE,            -- yyyy-MM-dd
  weight numeric(5,2) NOT NULL,         -- kg
  body_fat numeric(4,2),                -- % (선택)
  muscle_mass numeric(5,2),             -- kg (선택)
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 목표 체중 (단일 행 — id='default' 고정으로 upsert)
CREATE TABLE IF NOT EXISTS public.weight_goals (
  id text PRIMARY KEY DEFAULT 'default',
  start_weight numeric(5,2) NOT NULL,
  target_weight numeric(5,2) NOT NULL,
  target_body_fat numeric(4,2),
  target_muscle_mass numeric(5,2),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weight_records_date ON public.weight_records(date DESC);

-- RLS: owner 본인만 전체 권한 (기존 lockdown 마이그레이션과 동일 패턴)
DO $$
DECLARE
  uid constant text := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
  t text;
  tbls text[] := ARRAY['weight_records','weight_goals'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner only" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "owner only" ON public.%I FOR ALL TO authenticated USING (auth.uid() = %L) WITH CHECK (auth.uid() = %L)',
      t, uid, uid
    );
  END LOOP;
END $$;

-- Realtime publication 등록
ALTER PUBLICATION supabase_realtime ADD TABLE public.weight_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weight_goals;
