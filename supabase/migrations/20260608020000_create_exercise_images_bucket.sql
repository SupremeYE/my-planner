-- 운동 모듈 Stage 3 — 운동 종목 이미지 Storage 이관용 버킷
-- 목적: 종목 이미지를 GitHub raw 핫링크 → Supabase Storage 로 옮겨 자립화한다.
--       (핫링크는 외부 레포 의존 + 대역폭 리스크 → 자체 버킷으로 안정화)
--
-- 설계 메모:
--  - scrap-thumbs / food-photos / vision-board 와 동일한 public 버킷.
--  - 공개 읽기: 종목 카드/시트에서 단순 <img src> 로 표시.
--  - 쓰기: 이관 스크립트/Edge Function 이 service_role 로 업로드(서비스롤은 RLS 우회).
--    아래 insert 정책은 안전망(인증 사용자만)으로만 둔다.

insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;

drop policy if exists "Exercise images public read"  on storage.objects;
drop policy if exists "Exercise images auth insert"  on storage.objects;
drop policy if exists "Exercise images auth update"  on storage.objects;
drop policy if exists "Exercise images auth delete"  on storage.objects;

create policy "Exercise images public read"
  on storage.objects for select
  using (bucket_id = 'exercise-images');

create policy "Exercise images auth insert"
  on storage.objects for insert
  with check (bucket_id = 'exercise-images' and auth.role() = 'authenticated');

create policy "Exercise images auth update"
  on storage.objects for update
  using (bucket_id = 'exercise-images' and auth.role() = 'authenticated');

create policy "Exercise images auth delete"
  on storage.objects for delete
  using (bucket_id = 'exercise-images' and auth.role() = 'authenticated');
