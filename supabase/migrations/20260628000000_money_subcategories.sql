-- 하온 머니 — 카테고리 2단계화(대분류 > 소분류)
-- money_categories 에 parent_id(자기참조) 추가 + 지출 대분류별 소분류 프리셋 시드.
--   · parent_id is null  → 대분류(기존 15종 유지)
--   · parent_id 값 있음  → 소분류(대분류에 연결)
--   · 거래.category_id 는 소분류를 가리킬 수 있고, 통계는 소분류 → 대분류로 롤업.
-- 멱등: 컬럼/인덱스/시드 모두 IF NOT EXISTS · NOT EXISTS 가드. money_categories 는 이미
--   supabase_realtime publication 에 등록되어 있어 추가 작업 불필요(컬럼만 추가).

-- ① parent_id 컬럼(자기참조, 대분류 삭제 시 소분류 동반 삭제)
alter table public.money_categories
  add column if not exists parent_id uuid references public.money_categories(id) on delete cascade;

-- ② 소분류 조회 인덱스
create index if not exists money_categories_user_parent_idx
  on public.money_categories (user_id, parent_id);

-- ③ 소분류 프리셋 시드 — 대분류(parent_id is null) 이름으로 연결, 멱등.
--    색/이모지는 비움(null) → UI 에서 대분류 색의 명도 변형으로 표시(같은 계열).
do $$
declare
  uid constant uuid := '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde';
  presets jsonb := '{
    "식비":   ["배달","외식","마트","편의점","카페·디저트","술·유흥","식재료"],
    "생필품": ["생활용품","주방용품","욕실·세제","반려동물","잡화"],
    "교통":   ["버스·지하철","택시","기차","비행기","주유","주차·통행료","자동차정비"],
    "카페":   ["커피","디저트","베이커리"],
    "쇼핑":   ["의류","신발·잡화","화장품·뷰티","전자제품","가구·인테리어","온라인쇼핑"],
    "문화":   ["영화·공연","도서","게임","취미","여행","OTT·콘텐츠"],
    "건강":   ["병원","약국","운동·헬스","영양제","미용·관리"],
    "통신":   ["휴대폰요금","인터넷","기타통신"],
    "구독":   ["OTT","음악","멤버십","소프트웨어"],
    "보험":   ["실비보험","생명보험","자동차보험","기타보험"],
    "주거":   ["월세·관리비","공과금(전기·가스·수도)","가스비","인터넷·TV"]
  }'::jsonb;
  v_parent_name text;
  v_subs jsonb;
  v_parent_id uuid;
  v_sub_name text;
  v_ord int;
begin
  for v_parent_name, v_subs in select * from jsonb_each(presets) loop
    select id into v_parent_id from public.money_categories
      where user_id = uid and type = 'expense' and name = v_parent_name and parent_id is null
      limit 1;
    if v_parent_id is null then continue; end if;  -- 대분류 없으면 skip
    v_ord := 0;
    for v_sub_name in select jsonb_array_elements_text(v_subs) loop
      if not exists (
        select 1 from public.money_categories
        where user_id = uid and parent_id = v_parent_id and name = v_sub_name
      ) then
        insert into public.money_categories (user_id, type, name, parent_id, is_default, sort_order)
        values (uid, 'expense', v_sub_name, v_parent_id, true, v_ord);
      end if;
      v_ord := v_ord + 1;
    end loop;
  end loop;
end $$;
