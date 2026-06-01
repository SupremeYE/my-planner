-- 식단 dining_type CHECK 제약에 'coffee'(카페) 누락 버그 수정
--
-- 배경: 앱 코드(DiningType, FoodView UI)는 식사 유형으로 'home','delivery',
--       'restaurant','coffee' 4종을 제공하는데, DB의 food_records_dining_type_check
--       제약은 'home','delivery','restaurant' 3종만 허용했다.
-- 증상: 사용자가 '카페(coffee)'를 선택해 식단을 저장하면 INSERT가 CHECK 제약을
--       위반해 PostgREST가 400을 반환 → DB 저장 실패. 화면에는 낙관적 업데이트로
--       추가된 것처럼 보이지만, 앱을 다시 열면(서버에서 재조회) 사라진다.
-- 조치: 제약을 코드와 일치하도록 'coffee' 포함하여 재정의한다.
ALTER TABLE public.food_records DROP CONSTRAINT IF EXISTS food_records_dining_type_check;
ALTER TABLE public.food_records ADD CONSTRAINT food_records_dining_type_check
  CHECK (dining_type IS NULL OR dining_type IN ('home', 'delivery', 'restaurant', 'coffee'));
