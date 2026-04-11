-- 연간 목표 테이블 생성
CREATE TABLE IF NOT EXISTS annual_goals (
  id           text PRIMARY KEY,
  year         integer NOT NULL,
  text         text NOT NULL,
  done         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 분기 목표 테이블 생성
CREATE TABLE IF NOT EXISTS quarterly_goals (
  id           text PRIMARY KEY,
  year         integer NOT NULL,
  quarter      integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  text         text NOT NULL,
  done         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- user_settings에 연간 정체성 / 핵심 가치 컬럼 추가
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS annual_identity text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS annual_values   text[]  DEFAULT NULL;

-- RLS (Row Level Security) — 기존 테이블과 동일하게 public 허용
ALTER TABLE annual_goals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_goals ENABLE ROW LEVEL SECURITY;

-- IF NOT EXISTS 는 PG/Supabase 일부 버전에서 CREATE POLICY 에 지원되지 않음 → DROP 후 CREATE
DROP POLICY IF EXISTS "Allow all annual_goals" ON annual_goals;
CREATE POLICY "Allow all annual_goals" ON annual_goals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all quarterly_goals" ON quarterly_goals;
CREATE POLICY "Allow all quarterly_goals" ON quarterly_goals FOR ALL USING (true) WITH CHECK (true);
