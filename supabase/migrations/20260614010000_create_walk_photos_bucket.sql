-- 산책(Walk) 모듈 — Phase 0: 완료 카드 사진용 Storage 버킷
-- 목적: 산책 완료 기록 카드의 사진을 저장한다.
--
-- 설계 메모:
--  - food-photos / moment-photos / recipe-photos / scrap-thumbs 와 동일한 public 버킷.
--  - 공개 읽기: 기록 카드/목록에서 단순 <img src> 로 표시.
--  - 쓰기/수정/삭제: 인증 사용자만(안전망). 경로 규칙은 db 레이어가 `<walkSessionId>.<ext>` 로 둔다.

insert into storage.buckets (id, name, public)
values ('walk-photos', 'walk-photos', true)
on conflict (id) do nothing;

drop policy if exists "Walk photos public read"  on storage.objects;
drop policy if exists "Walk photos auth insert"  on storage.objects;
drop policy if exists "Walk photos auth update"  on storage.objects;
drop policy if exists "Walk photos auth delete"  on storage.objects;

create policy "Walk photos public read"
  on storage.objects for select
  using (bucket_id = 'walk-photos');

create policy "Walk photos auth insert"
  on storage.objects for insert
  with check (bucket_id = 'walk-photos' and auth.role() = 'authenticated');

create policy "Walk photos auth update"
  on storage.objects for update
  using (bucket_id = 'walk-photos' and auth.role() = 'authenticated');

create policy "Walk photos auth delete"
  on storage.objects for delete
  using (bucket_id = 'walk-photos' and auth.role() = 'authenticated');
