-- self_care_records 테이블에 수면 기록용 컬럼 추가
-- sleep 카테고리 레코드에서만 사용됨
-- sleep_start: 취침 시간 "HH:mm"
-- sleep_end:   기상 시간 "HH:mm"
-- duration:    기존 컬럼 재활용 (수면 시간 분 단위)

ALTER TABLE self_care_records
  ADD COLUMN IF NOT EXISTS sleep_start TEXT,
  ADD COLUMN IF NOT EXISTS sleep_end   TEXT;
