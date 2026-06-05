-- 모먼트 하이라이트 플래그
--
-- 배경: 모먼트 모바일 UI v2 Phase 3 — 사용자가 별표로 즐겨찾기한 모먼트를 연도별
--       "하이라이트" 행과 스탯에 별도 노출하기 위한 boolean 플래그.
-- 기본값 false. 기존 데이터는 그대로 유지.
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS is_highlight boolean DEFAULT false NOT NULL;
