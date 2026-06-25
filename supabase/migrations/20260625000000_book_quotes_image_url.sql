-- book_quotes 에 image_url 컬럼 추가 (크롭된 구절 사진 URL)
-- - nullable: 기존 행은 NULL, 사진으로 담은 구절만 채워짐
-- - Realtime publication 은 기 등록 상태(book_quotes 가 이미 supabase_realtime 에 포함됨)
ALTER TABLE public.book_quotes
  ADD COLUMN IF NOT EXISTS image_url text;
