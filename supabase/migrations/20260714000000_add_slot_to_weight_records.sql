-- 몸무게 아침/저녁/기타 분리 기록: weight_records 에 slot 필드 추가.
-- 하루 date UNIQUE → (date, slot) UNIQUE 로 교체해 하루에 여러 slot 공존 허용.
-- 기존 기록(마이그레이션 시점 0행)은 default '기타'로 백필. 라이브 충돌 없음(저위험).
alter table public.weight_records add column slot text not null default '기타';
alter table public.weight_records drop constraint weight_records_date_key;
alter table public.weight_records add constraint weight_records_date_slot_key unique (date, slot);
alter table public.weight_records add constraint weight_records_slot_check check (slot in ('아침','저녁','기타'));
