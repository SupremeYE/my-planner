-- 하온 머니 — 고정비 외화 환율 추적 컬럼.
--  · fx_rate       : 직전에 적용한 1단위 환율(예: 1 USD = 1330.50 KRW). 원화 고정비는 null.
--  · fx_rate_date  : 그 환율을 가져온 날짜(결제일 직전 1회만 갱신하는 사이클 가드용).
--  · fx_change_pct : 직전 환율 대비 변동률(%). ±settings.fx_alert_threshold 초과 시 알림 표시.
-- 모두 nullable — 원화/기존 행은 그대로 동작(하위호환).

alter table money_fixed_costs
  add column if not exists fx_rate numeric,
  add column if not exists fx_rate_date date,
  add column if not exists fx_change_pct numeric;
