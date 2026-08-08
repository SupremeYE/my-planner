-- 만다라트 셀별 색상 컬럼 추가 — 목표 페이지 Stage B (만다라트 재설계).
-- 목적: 서브목표(중앙 블록 세부)마다 색을 지정해 좌측 3px 액센트 바 + 외곽 미러 셀에 반영한다.
-- color: 팔레트 '키'를 저장한다(hex 아님). 디자인 토큰이 바뀌어도 DB 무변경 = 색 하드코딩 금지 원칙과 동일.
--   허용값 6색: lilac / blue / sage / magenta / purple / teal.
--   ⚠️ 코랄은 팔레트에서 제외 — 선택 상태·중심 코어목표 전용(목표 색으로 쓰면 의미가 흐려짐).
--   nullable(NULL = 색 미지정, 기본 색 사용). NULL 은 CHECK 를 통과한다.
--   프로젝트 관례(monthly_goals.retro_status, weight_records.slot 등) = CHECK in.
alter table public.mandalart_cells
  add column if not exists color text;

alter table public.mandalart_cells
  drop constraint if exists mandalart_cells_color_check;
alter table public.mandalart_cells
  add constraint mandalart_cells_color_check
  check (color in ('lilac', 'blue', 'sage', 'magenta', 'purple', 'teal'));
