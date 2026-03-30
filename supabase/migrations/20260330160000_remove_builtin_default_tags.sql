-- 기존 하드코딩 기본 태그 제거
-- 대상: 일, 자기계발, 자기관리, 일상, 건강 (legacy id: tg1~tg5)

DO $$
DECLARE
  default_tag_ids TEXT[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::TEXT[])
    INTO default_tag_ids
  FROM tags
  WHERE id IN ('tg1', 'tg2', 'tg3', 'tg4', 'tg5')
     OR name IN ('일', '자기계발', '자기관리', '일상', '건강');

  IF array_length(default_tag_ids, 1) IS NOT NULL THEN
    UPDATE todos
    SET tags = COALESCE(
      (
        SELECT array_agg(tag_id)
        FROM unnest(COALESCE(todos.tags, ARRAY[]::TEXT[])) AS tag_id
        WHERE NOT (tag_id = ANY(default_tag_ids))
      ),
      ARRAY[]::TEXT[]
    )
    WHERE tags && default_tag_ids;

    DELETE FROM tags
    WHERE id = ANY(default_tag_ids);
  END IF;
END $$;
