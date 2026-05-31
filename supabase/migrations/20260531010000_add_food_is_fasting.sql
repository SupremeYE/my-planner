-- 식단 단식(fasting) 기록 지원
--
-- 배경: 식단 페이지에서 특정 끼니를 거른 경우 "기록 없음"과 구분되지 않았다.
--       거른 끼니를 명시적으로 '단식'으로 기록해 달력·통계에 반영하기 위한 플래그.
-- 단식 레코드 저장 형태: food_name='단식', amount=0, calories=0, is_fasting=true.
ALTER TABLE public.food_records ADD COLUMN IF NOT EXISTS is_fasting boolean DEFAULT false;
