-- routines 테이블에 단계별 구조화 데이터 컬럼 추가
-- 실행 위치: Supabase Dashboard > SQL Editor

ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS routine_steps JSONB DEFAULT NULL;

-- 기존 steps / step_youtube_urls 는 하위 호환을 위해 유지
