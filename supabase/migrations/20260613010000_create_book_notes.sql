-- book_notes 테이블: 책 전체에 대한 자유 메모 (목적/아웃풋 등)
-- - type 은 'purpose'(왜 읽는가), 'output'(읽고 나서) 두 값을 우선 사용
--   향후 'reread', 'takeaway' 등으로 확장 가능하도록 자유 text 로 둔다.
-- - (book_id, type) UNIQUE → 한 책당 같은 종류 노트는 1행만, upsert 가능
-- - RLS 는 기존 book_quotes 와 동일한 단일 사용자 정책을 사용
-- - Realtime publication 에 등록해 PC ↔ 모바일 동기화
CREATE TABLE IF NOT EXISTS public.book_notes (
  id text PRIMARY KEY,
  book_id text NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT book_notes_book_type_uniq UNIQUE (book_id, type)
);

CREATE INDEX IF NOT EXISTS book_notes_book_id_idx ON public.book_notes(book_id);

ALTER TABLE public.book_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner only" ON public.book_notes;
CREATE POLICY "owner only" ON public.book_notes
  FOR ALL
  USING (auth.uid() = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'::uuid)
  WITH CHECK (auth.uid() = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde'::uuid);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.book_notes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS book_notes_set_updated_at ON public.book_notes;
CREATE TRIGGER book_notes_set_updated_at
  BEFORE UPDATE ON public.book_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.book_notes_touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.book_notes;
