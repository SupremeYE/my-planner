-- 독서 구절 사진 캡처 — Storage 버킷
-- 목적: 책 페이지 촬영 → 크롭한 구절 사진을 저장하고, 구절 카드에 그대로 표시한다.
--
-- 설계 메모:
--  - beauty-photos / recipe-photos / walk-photos 와 동일한 public 버킷 + 인증 사용자 RLS 패턴 그대로 복제.
--  - public read: 구절 카드에서 단순 <img src> 로 표시 가능하게.
--  - insert/update/delete: 로그인한 사용자만 (auth.role() = 'authenticated').
--  - 경로 규칙은 db 레이어가 `<quoteId>_<uuid>.<ext>` 평면 경로로 둔다(슬래시 경로는 클라 업로드 400 유발).

insert into storage.buckets (id, name, public)
values ('book-photos', 'book-photos', true)
on conflict (id) do nothing;

drop policy if exists "Book photos public read"  on storage.objects;
drop policy if exists "Book photos auth insert"  on storage.objects;
drop policy if exists "Book photos auth update"  on storage.objects;
drop policy if exists "Book photos auth delete"  on storage.objects;

create policy "Book photos public read"
  on storage.objects for select
  using (bucket_id = 'book-photos');

create policy "Book photos auth insert"
  on storage.objects for insert
  with check (bucket_id = 'book-photos' and auth.role() = 'authenticated');

create policy "Book photos auth update"
  on storage.objects for update
  using (bucket_id = 'book-photos' and auth.role() = 'authenticated');

create policy "Book photos auth delete"
  on storage.objects for delete
  using (bucket_id = 'book-photos' and auth.role() = 'authenticated');
