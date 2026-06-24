-- recipe-photos: anon 쓰기 허용으로 정책 교체
-- 배경: 앱은 로그인 없이 anon 키로만 동작하는데, 기존 recipe-photos 정책은
--       to authenticated (또는 auth.role()='authenticated') 라 anon 업로드가 RLS 로 거부됨
--       → 레시피 대표사진 업로드 + 사진 AI(vision-extract) 입력 업로드가 모두 실패.
-- 해결: 이미 정상 동작하는 food-photos/moment-photos 와 동일하게 anon(public) 쓰기 허용.
--       (1인용 개인 앱 — 다른 사진 버킷과 동일한 보안 포스처)
-- 읽기: 버킷이 public 이라 getPublicUrl 로 접근(별도 select 정책 불필요).

drop policy if exists "recipe-photos authenticated insert" on storage.objects;
drop policy if exists "recipe-photos owner update"        on storage.objects;
drop policy if exists "recipe-photos owner delete"        on storage.objects;
drop policy if exists "recipe-photos anon insert"         on storage.objects;
drop policy if exists "recipe-photos anon update"         on storage.objects;
drop policy if exists "recipe-photos anon delete"         on storage.objects;

create policy "recipe-photos anon insert"
  on storage.objects for insert to public
  with check (bucket_id = 'recipe-photos');

create policy "recipe-photos anon update"
  on storage.objects for update to public
  using (bucket_id = 'recipe-photos');

create policy "recipe-photos anon delete"
  on storage.objects for delete to public
  using (bucket_id = 'recipe-photos');
