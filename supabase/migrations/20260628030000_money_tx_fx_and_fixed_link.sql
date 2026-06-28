-- 하온 머니 — 거래 외화 환산 + 고정비 자동 기록 연결.
--  · original_amount/currency/fx_rate : 외화 거래의 원금/통화/적용환율(원화 amount 와 함께 보존).
--  · fixed_cost_id : 이 거래가 어떤 고정비에서 자동 생성됐는지(source='fixed'). 고정비 삭제 시 null(이력 보존).
-- 멱등: (fixed_cost_id, spent_at) 유니크 → 같은 고정비·같은 결제일 중복 기록 방지(1주기 1건).
alter table money_transactions
  add column if not exists original_amount numeric,
  add column if not exists currency text not null default 'KRW',
  add column if not exists fx_rate numeric,
  add column if not exists fixed_cost_id uuid references money_fixed_costs(id) on delete set null;

create unique index if not exists money_tx_fixed_once
  on money_transactions (fixed_cost_id, spent_at)
  where fixed_cost_id is not null;
