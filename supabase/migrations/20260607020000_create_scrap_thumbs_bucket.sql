-- 스크랩 / 영감 보관함 — Stage 1
-- 목적: 인스타·스레드처럼 자동 메타 가져오기가 안 되는 출처용 수동 스크린샷 업로드 버킷.
--       그 외(유튜브/웹)도 사용자가 직접 썸네일을 올리고 싶으면 사용.
--
-- 설계 메모:
--  - vision-board / moment-photos / food-photos 와 동일한 public 버킷 + 인증 사용자 RLS.
--  - public read: 그리드 카드에서 단순 <img src> 로 표시 가능하게.
--  - insert/update/delete: 로그인한 사용자만 (auth.role() = 'authenticated').

insert into storage.buckets (id, name, public)
values ('scrap-thumbs', 'scrap-thumbs', true)
on conflict (id) do nothing;

drop policy if exists "Scrap thumbs public read"    on storage.objects;
drop policy if exists "Scrap thumbs owner insert"   on storage.objects;
drop policy if exists "Scrap thumbs owner update"   on storage.objects;
drop policy if exists "Scrap thumbs owner delete"   on storage.objects;

create policy "Scrap thumbs public read"
  on storage.objects for select
  using (bucket_id = 'scrap-thumbs');

create policy "Scrap thumbs owner insert"
  on storage.objects for insert
  with check (bucket_id = 'scrap-thumbs' and auth.role() = 'authenticated');

create policy "Scrap thumbs owner update"
  on storage.objects for update
  using (bucket_id = 'scrap-thumbs' and auth.role() = 'authenticated');

create policy "Scrap thumbs owner delete"
  on storage.objects for delete
  using (bucket_id = 'scrap-thumbs' and auth.role() = 'authenticated');
