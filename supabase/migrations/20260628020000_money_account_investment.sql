-- 하온 머니 — 투자계좌(type='investment') 포트폴리오 필드.
--  · invest_kind : 종목 구분('stock'|'fund'|'coin'). 예금/적금/현금은 null.
--  · principal   : 매입원금(투자원금) — 수익률 계산 기준. 모르면 null(등락률 미표시).
--  · quantity    : 보유수량(주/구좌/개). 선택값.
-- balance 컬럼을 "현재 평가액"으로 재사용 → 등락률 = (balance - principal)/principal.
-- 모두 nullable — 비투자 계좌/기존 행은 그대로 동작(하위호환). money_accounts 는 이미 realtime publication 등록됨.
alter table money_accounts
  add column if not exists invest_kind text,
  add column if not exists principal numeric,
  add column if not exists quantity numeric;
