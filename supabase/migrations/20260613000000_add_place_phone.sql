-- 가고싶은 곳 Stage 3A — places 에 phone 컬럼 추가
-- 카카오 키워드 검색 결과의 전화번호(phone)를 저장 시점 1회 박아두고 이후 읽기만 한다.
alter table public.places add column if not exists phone text;
