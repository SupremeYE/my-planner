-- Ensure routines table is compatible with app code.
-- Safe migration: creates table if missing, adds missing columns,
-- and enables permissive RLS policy for current single-user setup.

CREATE TABLE IF NOT EXISTS routines (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  icon               text NOT NULL DEFAULT '🌅',
  start_time         text NOT NULL DEFAULT '07:00',
  duration           integer NOT NULL DEFAULT 0,
  steps              text[] NOT NULL DEFAULT '{}',
  step_youtube_urls  text[] NOT NULL DEFAULT '{}',
  routine_steps      jsonb DEFAULT NULL,
  checked_dates      text[] NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '🌅',
  ADD COLUMN IF NOT EXISTS start_time text NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS duration integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS steps text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS step_youtube_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS routine_steps jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checked_dates text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all routines" ON routines;
CREATE POLICY "Allow all routines"
  ON routines
  FOR ALL
  USING (true)
  WITH CHECK (true);
