-- 캡처 인박스 — capture_inbox 테이블
-- 목적: 음성/텍스트를 단일 입구(Edge Function `capture`)로 받아, 서버가 gpt-4o-mini 로 자동 분류한
--       "제안(proposed)"을 미분류 상태로 임시 보관한다. 사용자는 Stage 2 인박스 화면에서 스와이프 한 번으로
--       승인 → 그때 클라이언트가 기존 store 액션으로 목적지(todos/events/someday_seeds/money_transactions)에 저장한다.
--
-- 설계 결정(Stage 1 확정):
--  - 서버(`capture` 함수)는 이 테이블까지만 insert 하고, 목적지 테이블 저장은 하지 않는다(Stage 2 승인 시 클라).
--  - 승인 후에도 인박스 레코드를 삭제하지 않는다 → status='routed' + routed_table/routed_ref_id/routed_at 로 흔적 보존.
--  - proposed_type 은 4종(todo/event/seed/money). 판단 불가 시 NULL — 실패가 아니라 정상 상태(억지 분류 금지).
--
-- Auth 컨벤션(단일 사용자 — someday_seeds / places / diary_entries 패턴):
--  - RLS 는 "로그인한 본인(소유자)만" select/update/delete. **insert 정책은 만들지 않는다** —
--    이 테이블은 오직 Edge Function 이 service role(RLS 우회)로만 넣는다. 클라 직접 insert 경로 없음.
--  - user_id 는 서버가 HAON_OWNER_USER_ID 로 명시 주입한다(클라 insert 가 없어 default auth.uid() 불필요).

-- ── capture_inbox — 캡처 한 건 = 한 행 ──────────────────────────────────────────
create table if not exists public.capture_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 원문(음성 STT 결과 포함). 공백만/빈 문자열 방지 + 상한 2000자. 분류가 실패해도 이 raw 는 반드시 남는다.
  raw_text text not null check (char_length(btrim(raw_text)) between 1 and 2000),
  source text not null default 'shortcut' check (source in ('shortcut','web','manual')),
  status text not null default 'pending' check (status in ('pending','routed','discarded')),
  -- 서버 자동 분류 제안. 판단 불가 시 NULL(정상). CHECK 로 목적지 4종 고정.
  proposed_type text check (proposed_type in ('todo','event','seed','money')),
  proposed_payload jsonb,                 -- type 별 정규화된 필드(승인 시 클라가 store 액션 인자로 사용)
  confidence real,                        -- 분류 확신도 0~1
  classifier_error text,                  -- 분류 실패 사유(있을 때만). NULL = 정상
  -- 승인(routed) 흔적 — Stage 2 에서 채운다. 이 단계에선 항상 NULL.
  routed_table text,                      -- 저장된 목적지 테이블명(todos/events/someday_seeds/money_transactions)
  routed_ref_id text,                     -- 목적지 레코드 id(폴리모픽 — text id/uuid 혼재라 FK 없이 plain text)
  routed_at timestamptz,
  captured_at timestamptz not null default now(),   -- 캡처 시각(클라/Shortcuts 가 보내면 그 값)
  created_at timestamptz not null default now()
);

alter table public.capture_inbox enable row level security;

drop policy if exists "Users can view their own capture_inbox"   on public.capture_inbox;
drop policy if exists "Users can update their own capture_inbox" on public.capture_inbox;
drop policy if exists "Users can delete their own capture_inbox" on public.capture_inbox;

-- select / update / delete 만. insert 정책은 의도적으로 없음(서버 service role 전용 삽입).
create policy "Users can view their own capture_inbox"
  on public.capture_inbox for select using (user_id = auth.uid());
create policy "Users can update their own capture_inbox"
  on public.capture_inbox for update using (user_id = auth.uid());
create policy "Users can delete their own capture_inbox"
  on public.capture_inbox for delete using (user_id = auth.uid());

-- 인박스 목록: 본인 + 상태 필터 + 최신 캡처순
create index if not exists capture_inbox_user_status_captured_idx
  on public.capture_inbox (user_id, status, captured_at desc);

-- ── Realtime publication 등록 (이미 등록된 경우 skip) ──────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'capture_inbox'
  ) then
    execute 'alter publication supabase_realtime add table public.capture_inbox';
  end if;
end $$;
