-- 모먼트 수동 정렬 순서
--
-- 배경: 모먼트 모바일 UI v2 Phase 4 — 같은 월 안에서 사용자가 모아보기 타일을 드래그로
--       재배치할 수 있게 하는 수동 정렬 키. NULL이면 기본 정렬(created_at DESC) 적용.
-- 정렬 우선순위: sort_order ASC NULLS LAST → created_at DESC.
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS sort_order integer;
