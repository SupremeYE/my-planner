-- 통합 일기(diary_entries) + 질문 풀(journal_questions) 테이블 생성 — Stage 0
-- 목적: 오늘 일기 / 질문일기 / 이날의 기억을 하나의 데이터 기반으로 통합한다.
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션에 맞춤, culture_records / music_records 패턴 동일):
--  - user_id 는 DEFAULT auth.uid() 로 자동 채운다. 클라이언트(db.ts)가 user_id 를
--    따로 보내지 않아도 INSERT 시점의 로그인 사용자가 들어간다.
--  - RLS 는 "로그인한 본인(소유자)만" 정책으로 select/insert/update/delete 통일.
--    단, journal_questions 의 "기본 질문(is_default=true, user_id=null)"은 공용이라
--    누구나 SELECT 가능하도록 예외를 둔다(seed 108개).
--  - Realtime: PC↔모바일 즉시 반영 원칙에 따라 supabase_realtime publication 에 등록.

-- =====================================================================
-- 1) journal_questions — 질문 풀 (기본 질문 + 나만의 질문)
-- =====================================================================
create table if not exists public.journal_questions (
  id          uuid primary key default gen_random_uuid(),
  -- 나만의 질문은 사용자 소유, 기본 질문은 공용(null). seed 는 migration 으로
  -- 들어가므로 auth.uid()=null → 기본 질문은 user_id=null 로 저장된다.
  user_id     uuid default auth.uid() references auth.users(id) on delete cascade,
  category    text not null,   -- 영문키: self/emotion/value/relationship/work/future/fear/past/today/gratitude/body/courage
  category_ko text not null,   -- 한글 표시명
  text        text not null,   -- 질문 내용
  is_default  boolean not null default true,  -- 기본 질문(true) vs 나만의 질문(false)
  sort_order  int,
  created_at  timestamptz not null default now()
);

alter table public.journal_questions enable row level security;

drop policy if exists "Read default or own questions"   on public.journal_questions;
drop policy if exists "Insert own questions"             on public.journal_questions;
drop policy if exists "Update own questions"             on public.journal_questions;
drop policy if exists "Delete own questions"             on public.journal_questions;

-- 기본 질문(user_id null)은 모두 조회 가능 + 본인 소유 질문 조회 가능
create policy "Read default or own questions"
  on public.journal_questions for select
  using (user_id is null or auth.uid() = user_id);

-- 나만의 질문은 본인 소유로만 추가 가능(기본 질문은 seed/migration 으로만 생성)
create policy "Insert own questions"
  on public.journal_questions for insert
  with check (auth.uid() = user_id);

-- 본인 소유 질문만 수정/삭제(기본 질문은 보호)
create policy "Update own questions"
  on public.journal_questions for update
  using (auth.uid() = user_id);

create policy "Delete own questions"
  on public.journal_questions for delete
  using (auth.uid() = user_id);

create index if not exists journal_questions_category_idx
  on public.journal_questions (category, sort_order);
create index if not exists journal_questions_user_idx
  on public.journal_questions (user_id);

-- =====================================================================
-- 2) diary_entries — 자유일기 + 질문일기 통합(type 으로 구분)
-- =====================================================================
create table if not exists public.diary_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date    date not null,                        -- 일기 대상 날짜(이날의 기억은 이 날짜의 월/일 기준)
  type          text not null check (type in ('free','question')),
  -- 질문일기일 때만 연결. 질문이 삭제돼도 일기는 보존하기 위해 ON DELETE SET NULL +
  -- 작성 시점 질문 스냅샷(question_text)을 함께 저장한다.
  question_id   uuid references public.journal_questions(id) on delete set null,
  question_text text,                                 -- 작성 시점 질문 스냅샷
  content       text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.diary_entries enable row level security;

drop policy if exists "Users can view their own entries"   on public.diary_entries;
drop policy if exists "Users can insert their own entries" on public.diary_entries;
drop policy if exists "Users can update their own entries" on public.diary_entries;
drop policy if exists "Users can delete their own entries" on public.diary_entries;

create policy "Users can view their own entries"
  on public.diary_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own entries"
  on public.diary_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own entries"
  on public.diary_entries for update
  using (auth.uid() = user_id);

create policy "Users can delete their own entries"
  on public.diary_entries for delete
  using (auth.uid() = user_id);

-- entry_date 조회 인덱스(사용자별)
create index if not exists diary_entries_user_date_idx
  on public.diary_entries (user_id, entry_date);

-- "이날의 기억"용: 월/일로 거르는 조회가 잦으므로 expression 인덱스
-- entry_date 는 date 타입이라 extract 가 IMMUTABLE → 인덱스 가능
create index if not exists diary_entries_user_monthday_idx
  on public.diary_entries (
    user_id,
    (extract(month from entry_date)),
    (extract(day   from entry_date))
  );

-- 자유일기는 하루 1개 권장 → type='free' 부분 유니크 인덱스(사용자별)
-- 질문일기(type='question')는 하루 여러 개 허용(제약 없음)
create unique index if not exists diary_entries_free_one_per_day_uidx
  on public.diary_entries (user_id, entry_date)
  where type = 'free';

-- =====================================================================
-- 3) Realtime publication 등록 (이미 등록된 경우 skip)
-- =====================================================================
do $$
declare
  tbl text;
begin
  foreach tbl in array array['journal_questions','diary_entries']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;

-- =====================================================================
-- 4) seed — 기본 질문 108개(12 카테고리)
--    is_default=true(기본값), user_id=null(공용). 재실행 안전을 위해
--    기본 질문이 하나도 없을 때만 삽입한다.
-- =====================================================================
do $$
begin
  if not exists (select 1 from public.journal_questions where is_default = true) then
    insert into public.journal_questions (category, category_ko, text, sort_order) values
      ('self', '자기 이해', '나를 한 문장으로 표현한다면?', 1),
      ('self', '자기 이해', '남들은 모르는 나만의 모습은 무엇인가?', 2),
      ('self', '자기 이해', '나는 어떤 사람으로 기억되고 싶은가?', 3),
      ('self', '자기 이해', '내가 가장 나다울 때는 언제인가?', 4),
      ('self', '자기 이해', '어떤 사람이 되고 싶은가?', 5),
      ('self', '자기 이해', '나의 가장 큰 강점은 무엇이라고 생각하는가?', 6),
      ('self', '자기 이해', '고치고 싶은 나의 습관은 무엇인가?', 7),
      ('self', '자기 이해', '혼자 있을 때의 나는 어떤 모습인가?', 8),
      ('self', '자기 이해', '다른 사람의 시선을 신경 쓰지 않는다면, 나는 무엇을 하고 있을까?', 9),
      ('emotion', '감정과 마음', '지금 내 마음은 어떤 상태인가?', 10),
      ('emotion', '감정과 마음', '최근 가장 크게 느낀 감정은 무엇이었나?', 11),
      ('emotion', '감정과 마음', '요즘 나를 가장 지치게 하는 것은 무엇인가?', 12),
      ('emotion', '감정과 마음', '내가 자주 억누르는 감정이 있다면?', 13),
      ('emotion', '감정과 마음', '화가 났을 때 나는 어떻게 반응하는가?', 14),
      ('emotion', '감정과 마음', '마음이 편안해지는 순간은 언제인가?', 15),
      ('emotion', '감정과 마음', '표현하지 못하고 삼킨 말이 있는가?', 16),
      ('emotion', '감정과 마음', '나를 울게 만드는 것은 무엇인가?', 17),
      ('emotion', '감정과 마음', '지금 가장 위로받고 싶은 부분은?', 18),
      ('value', '가치관과 신념', '나에게 ''성공''이란 무엇인가?', 19),
      ('value', '가치관과 신념', '절대 타협하고 싶지 않은 가치는 무엇인가?', 20),
      ('value', '가치관과 신념', '돈, 시간, 관계 중 지금 나에게 가장 소중한 것은?', 21),
      ('value', '가치관과 신념', '옳다고 믿지만 실천하지 못하는 것이 있는가?', 22),
      ('value', '가치관과 신념', '나는 무엇을 위해 살고 있는가?', 23),
      ('value', '가치관과 신념', '''좋은 삶''이란 나에게 어떤 모습인가?', 24),
      ('value', '가치관과 신념', '최근에 가치관이 바뀐 경험이 있는가?', 25),
      ('value', '가치관과 신념', '내가 절대 용납할 수 없는 것은 무엇인가?', 26),
      ('value', '가치관과 신념', '나는 어떤 기준으로 선택을 내리는가?', 27),
      ('relationship', '관계와 사랑', '지금 내 곁에 가장 소중한 사람은 누구인가?', 28),
      ('relationship', '관계와 사랑', '오늘 누군가에게 감사하지 못한 순간이 있었는가?', 29),
      ('relationship', '관계와 사랑', '표현하고 싶지만 못 한 마음이 있다면 누구에게?', 30),
      ('relationship', '관계와 사랑', '나는 사람들에게 어떤 존재이고 싶은가?', 31),
      ('relationship', '관계와 사랑', '멀어진 관계 중 다시 잇고 싶은 사이가 있는가?', 32),
      ('relationship', '관계와 사랑', '나에게 사랑은 어떤 모습인가?', 33),
      ('relationship', '관계와 사랑', '사람들과 있을 때와 혼자일 때, 나는 어떻게 다른가?', 34),
      ('relationship', '관계와 사랑', '최근 누군가에게 상처를 주거나 받은 적이 있는가?', 35),
      ('relationship', '관계와 사랑', '나를 있는 그대로 받아주는 사람은 누구인가?', 36),
      ('work', '일과 성장', '지금 하는 일에서 나는 무엇을 배우고 있는가?', 37),
      ('work', '일과 성장', '내가 자주 미루는 것은 무엇이고, 그 이유는?', 38),
      ('work', '일과 성장', '일이 잘 풀리지 않을 때 나는 어떻게 대처하는가?', 39),
      ('work', '일과 성장', '최근 가장 성장했다고 느낀 순간은?', 40),
      ('work', '일과 성장', '내가 진짜 잘하고 싶은 일은 무엇인가?', 41),
      ('work', '일과 성장', '지금 가장 큰 부담으로 느껴지는 과제는?', 42),
      ('work', '일과 성장', '1년 전의 나와 지금의 나는 무엇이 달라졌나?', 43),
      ('work', '일과 성장', '나는 무엇을 할 때 시간 가는 줄 모르는가?', 44),
      ('work', '일과 성장', '더 이상 미루지 말아야 할 일은 무엇인가?', 45),
      ('future', '꿈과 미래', '10년 후 나는 어떤 모습이길 바라는가?', 46),
      ('future', '꿈과 미래', '돈과 시간이 충분하다면 무엇을 하고 싶은가?', 47),
      ('future', '꿈과 미래', '올해 안에 꼭 이루고 싶은 한 가지는?', 48),
      ('future', '꿈과 미래', '미루고만 있던 꿈이 있다면 무엇인가?', 49),
      ('future', '꿈과 미래', '5년 뒤 오늘, 나는 어디서 무엇을 하고 있을까?', 50),
      ('future', '꿈과 미래', '죽기 전에 꼭 해보고 싶은 것은?', 51),
      ('future', '꿈과 미래', '지금 이 순간 내가 가장 원하는 것은 무엇인가?', 52),
      ('future', '꿈과 미래', '나는 어떤 미래를 두려워하고, 어떤 미래를 기대하는가?', 53),
      ('future', '꿈과 미래', '내 인생을 한 권의 책이라면, 다음 장의 제목은?', 54),
      ('fear', '두려움과 한계', '지금 내가 가장 두려워하는 것은?', 55),
      ('fear', '두려움과 한계', '두려움 때문에 포기한 것이 있는가?', 56),
      ('fear', '두려움과 한계', '실패한다면 무엇이 가장 무서운가?', 57),
      ('fear', '두려움과 한계', '나를 가장 불안하게 만드는 생각은 무엇인가?', 58),
      ('fear', '두려움과 한계', '나는 어떤 상황에서 작아지는가?', 59),
      ('fear', '두려움과 한계', '도망치고 싶은 현실이 있다면?', 60),
      ('fear', '두려움과 한계', '가장 극복하고 싶은 나의 약점은?', 61),
      ('fear', '두려움과 한계', '남에게 들키고 싶지 않은 모습은 무엇인가?', 62),
      ('fear', '두려움과 한계', '두려움이 사라진다면 가장 먼저 무엇을 하겠는가?', 63),
      ('past', '과거와 회고', '다시 돌아간다면 바꾸고 싶은 선택이 있는가?', 64),
      ('past', '과거와 회고', '지금의 나를 만든 결정적 순간은 무엇이었나?', 65),
      ('past', '과거와 회고', '가장 후회하는 일과, 그럼에도 배운 것은?', 66),
      ('past', '과거와 회고', '어린 시절의 나에게 해주고 싶은 말은?', 67),
      ('past', '과거와 회고', '잊지 못하는 행복한 기억 하나는?', 68),
      ('past', '과거와 회고', '나를 가장 크게 성장시킨 실패는 무엇인가?', 69),
      ('past', '과거와 회고', '용서하지 못한 사람이나 나 자신이 있는가?', 70),
      ('past', '과거와 회고', '과거의 나에게 고맙다고 말하고 싶은 순간은?', 71),
      ('past', '과거와 회고', '지금 내려놓아야 할 과거는 무엇인가?', 72),
      ('today', '오늘과 일상', '오늘 나를 가장 기쁘게 한 것은 무엇인가?', 73),
      ('today', '오늘과 일상', '오늘 내가 한 선택 중 가장 잘한 것은?', 74),
      ('today', '오늘과 일상', '오늘 하루를 색으로 표현한다면?', 75),
      ('today', '오늘과 일상', '오늘 가장 오래 머문 생각은 무엇이었나?', 76),
      ('today', '오늘과 일상', '오늘 나에게 작은 친절을 베푼 사람은?', 77),
      ('today', '오늘과 일상', '오늘 놓치고 지나간 작은 행복이 있다면?', 78),
      ('today', '오늘과 일상', '내일의 나에게 미리 해두고 싶은 말은?', 79),
      ('today', '오늘과 일상', '오늘 하루 중 다시 살고 싶은 한 순간은?', 80),
      ('today', '오늘과 일상', '오늘 나는 나를 잘 돌봤는가?', 81),
      ('gratitude', '감사와 행복', '오늘 감사한 세 가지는 무엇인가?', 82),
      ('gratitude', '감사와 행복', '당연하게 여겼지만 사실 감사한 것은?', 83),
      ('gratitude', '감사와 행복', '나를 미소 짓게 하는 사소한 것들은?', 84),
      ('gratitude', '감사와 행복', '최근 누군가에게 받은 고마운 마음이 있는가?', 85),
      ('gratitude', '감사와 행복', '나는 무엇을 가졌을 때 가장 충만함을 느끼는가?', 86),
      ('gratitude', '감사와 행복', '지금 내 삶에서 가장 만족스러운 부분은?', 87),
      ('gratitude', '감사와 행복', '행복이란 나에게 어떤 모습인가?', 88),
      ('gratitude', '감사와 행복', '돈으로 살 수 없는 것 중 가장 소중한 것은?', 89),
      ('gratitude', '감사와 행복', '오늘 나에게 ''괜찮다''고 말해줄 수 있는가?', 90),
      ('body', '몸과 휴식', '요즘 내 몸은 나에게 어떤 신호를 보내고 있는가?', 91),
      ('body', '몸과 휴식', '나는 충분히 쉬고 있는가?', 92),
      ('body', '몸과 휴식', '나를 진짜로 회복시키는 휴식은 무엇인가?', 93),
      ('body', '몸과 휴식', '최근 내 몸을 위해 한 좋은 일은?', 94),
      ('body', '몸과 휴식', '잠들기 전 나는 보통 무슨 생각을 하는가?', 95),
      ('body', '몸과 휴식', '에너지가 가장 충만한 시간대는 언제인가?', 96),
      ('body', '몸과 휴식', '미루고 있는 건강 습관이 있다면?', 97),
      ('body', '몸과 휴식', '몸과 마음 중 지금 더 지친 쪽은?', 98),
      ('body', '몸과 휴식', '내 몸에게 사과하거나 감사하고 싶은 것이 있는가?', 99),
      ('courage', '용기와 변화', '지금 내 삶에서 가장 바꾸고 싶은 한 가지는?', 100),
      ('courage', '용기와 변화', '변화를 가로막는 가장 큰 핑계는 무엇인가?', 101),
      ('courage', '용기와 변화', '작은 용기를 냈던 최근의 순간은?', 102),
      ('courage', '용기와 변화', '두렵지만 꼭 시작하고 싶은 일은?', 103),
      ('courage', '용기와 변화', '나는 무엇을 그만두어야 더 자유로워질까?', 104),
      ('courage', '용기와 변화', '내 안의 어떤 목소리를 더 믿어야 할까?', 105),
      ('courage', '용기와 변화', '오늘 나 자신에게 해주고 싶은 말은?', 106),
      ('courage', '용기와 변화', '한 가지를 바꿀 수 있다면 무엇을 바꾸겠는가?', 107),
      ('courage', '용기와 변화', '지금의 나에게 가장 필요한 결심은 무엇인가?', 108);
  end if;
end $$;
