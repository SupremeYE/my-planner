-- 반복 종료 "N회 후" 저장용 컬럼.
-- null = 무제한(기존 동작). 회수는 origin(첫 인스턴스) 포함 1-based.
-- recurrence_end_date 와 함께 있으면 더 이른 쪽이 적용된다(확장 시 파생 endDate = min).
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurrence_count integer;
COMMENT ON COLUMN todos.recurrence_count IS '반복 종료: 총 N회(origin 포함) 후 종료. null=무제한. recurrence_end_date와 함께 있으면 더 이른 쪽이 적용.';
