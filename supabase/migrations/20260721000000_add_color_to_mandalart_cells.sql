-- 만다라트 칸별 지정색 (Stage MANDALART-2)
-- 목적: 세부/행동 칸에 사용자가 고른 팔레트 색을 저장. (DESIGN.md §11 / MANDALA_PALETTE)
--
-- 설계:
--  - 저장값 = 팔레트 키('lilac'|'blue'|'sage'|'magenta'|'purple'|'teal'). places 패턴 — 토큰 키만
--    저장하고 raw hex 는 저장하지 않는다.
--  - NULL 허용, DB default 없음 → NULL = 미지정. 앱단에서 NULL→기본 lilac 으로 해석(렌더는 Stage 3).
--  - 핵심(core) 앵커·빈 칸은 애초에 color 미설정 → NULL 유지.
--  - NOT NULL·DB default·CHECK 제약을 넣지 않는다(검증은 앱단). 기존 행 영향 0(nullable 추가).
--  - Realtime: mandalart_cells 는 이미 supabase_realtime publication 에 등록됨
--    (20260606020000_create_mandalart.sql §3) → 추가 조치 불필요.

alter table public.mandalart_cells
  add column if not exists color text;  -- 'lilac'|'blue'|'sage'|'magenta'|'purple'|'teal' | NULL
