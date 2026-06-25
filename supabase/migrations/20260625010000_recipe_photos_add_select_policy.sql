-- recipe-photos: 누락된 SELECT 정책 추가 (이번 400 업로드 실패의 진짜 원인)
-- 배경:
--  - 다른 모든 사진 버킷(beauty/household/moment/food/exercise/vision/walk/scrap)에는
--    storage.objects SELECT 정책이 있는데, recipe-photos 만 insert/update/delete 만 있고
--    SELECT 정책이 누락돼 있었음(최초 마이그레이션에서 "버킷이 public 이니 불필요"로 빠뜨림).
--  - Supabase Storage 업로드는 INSERT ... RETURNING 으로 객체 메타데이터를 돌려받는데,
--    SELECT 정책이 없으면 RETURNING 이 RLS 로 막혀 업로드가 400 으로 실패한다.
--    (bucket public 플래그는 /object/public CDN 읽기에만 적용 — authenticated 업로드 경로와 별개)
-- 해결: 다른 버킷과 동일하게 public SELECT 정책 추가.

drop policy if exists "recipe-photos anon select" on storage.objects;
create policy "recipe-photos anon select"
  on storage.objects for select to public
  using (bucket_id = 'recipe-photos');
