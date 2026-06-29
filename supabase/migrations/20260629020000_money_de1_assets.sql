-- DE-1: 자산 종류 정비(입출금/은행) + 카드↔통장 연결 + 순자산 포함/기본통장 플래그
-- 보기/입력 전용 — 자동 잔액 반영 없음(DE-3 이체부터). 안전 변경(컬럼 추가 + 단일 데이터 보정).
--   · money_accounts.type 은 자유 text(CHECK 없음) → 'bank' 추가에 제약 변경 불필요.
--   · balance 컬럼은 이미 존재(초기 마이그레이션). card 신용/체크는 이미 type 으로 구분.

-- 1) money_accounts: 순자산 포함 여부 + 기본 통장 플래그
alter table public.money_accounts
  add column if not exists include_in_total boolean not null default true,
  add column if not exists is_default       boolean not null default false;

-- 2) money_cards: 결제(연결) 통장 — 삭제 시 연결만 해제(거래/카드는 유지)
alter table public.money_cards
  add column if not exists linked_account_id uuid references public.money_accounts(id) on delete set null;

-- 3) 기존 데이터 보정 — 이름에 '은행' 포함 + 현금으로 잘못 분류된 통장을 입출금/은행으로
update public.money_accounts
   set type = 'bank'
 where type = 'cash' and name ilike '%은행%';

comment on column public.money_accounts.include_in_total is '순자산 합계 포함 여부(보기 필터)';
comment on column public.money_accounts.is_default       is '기본 통장(급여/생활비 기준)';
comment on column public.money_cards.linked_account_id   is '결제 통장(체크=즉시 차감 / 신용=결제일 차감) — 자동반영은 DE-3부터';
