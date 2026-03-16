My Planner App
Figma AI 디자인 요청서
모바일(375px) + 데스크탑(1440px) 반응형 웹앱 UI/UX 설계

1. 프로젝트 개요
개인 생산성 관리 웹앱 (PWA)으로, 모바일과 PC 모두에서 사용합니다.
할일 관리, 타임박싱, 브레인스토밍, 습관 트래킹, 목표 설정을 하나의 앱에서 처리하며
PLAN(계획)과 DO(실행) 기록의 차이를 시각적으로 확인하여 회고할 수 있습니다.

디바이스: 모바일 375px (iPhone 기준) + 데스크탑 1440px — 각각 별도 프레임으로 설계
저장소: Google Sheets API 연동 (데이터 영구 저장, 기기 간 동기화)
분위기: 미니멀하고 차분한 톤. 크림/오프화이트 배경, 골드-웜 포인트 컬러, 다크 텍스트.

2. 화면 목록
총 5개의 주요 뷰로 구성됩니다.

① 데일리 뷰 (Daily View)
가장 자주 사용하는 메인 화면입니다.
• 상단: 날짜 표시 + 요일
• 오늘의 메인 3 섹션
• 하루 할일 중 핵심 3개를 강조 표시 (번호 뱃지 + 골드 포인트)
• 체크 시 취소선 + 달성 표시
• 타임테이블 섹션 (핵심 UI)
• 시간축(09:00~23:00) 기반 세로 타임라인
• 각 할일 블록에 PLAN 바(파스텔 컬러)와 DO 바(진한 컬러)를 나란히 표시
• PLAN: 내가 이 시간에 할 것이라고 계획한 시간 범위
• DO: 실제 타이머로 기록된 시작~종료 시간
• 두 바의 차이가 시각적으로 비교 가능해야 함 (회고용)
• 할일 목록 섹션
• 추가 / 체크 / 미루기(날짜 선택 팝업) / 취소 / 날짜 미지정(보관함)
• 각 할일 우측에 ⭐ 버튼으로 메인 3 지정
• 타이머 버튼: 누르면 DO 시간 자동 기록 시작 → 종료 시 자동 저장
• 습관 체크 섹션
• 습관 항목들을 칩(chip) 형태로 나열, 탭으로 토글
• 브레인스토밍 섹션
• 자유 텍스트 영역 (그날/그주 할일을 쭉 나열하는 용도)
• 작성된 항목을 드래그 or 버튼으로 '할일 목록'에 추가하거나 타임블록에 배치 가능

② 캘린더 뷰 (Calendar View)
월별 / 주별 / 일별 탭 전환이 가능한 화면입니다.
• 월별: 달력 그리드, 날짜에 할일 개수 표시 (점 or 숫자 뱃지)
• 주별: 7일 가로 배치 + 각 날짜의 타임테이블 미리보기
• 타임테이블에서 바로 PLAN 블록 드래그 배치 가능
• PLAN/DO 바 표시 (데일리 뷰와 동일한 시각화)
• 일별: 데일리 뷰와 동일한 레이아웃으로 이동
• 날짜 클릭 시 해당 날짜의 데일리 뷰로 이동

③ 주간 뷰 (Weekly View)
• 이번 주 날짜 범위 표시
• 7일 미니 그리드: 각 날의 완료 할일 수 / 전체 할일 수
• 주간 목표 섹션
• 월간 목표 하위에 속하는 주간 목표로 입력
• 체크 시 상위 월간 목표 달성률에 자동 반영
• 추가 / 체크 / 삭제
• 주간 달성률 프로그레스 바

④ 월간 뷰 (Monthly View)
• 이달의 목표 섹션
• 목표 추가 / 체크 / 삭제
• 각 월간 목표 아래에 관련 주간 목표 하위 항목으로 연결 표시
• 주간 목표 체크가 누적되면 월간 목표 달성률 자동 계산
• 달성률 프로그레스 바 (0~100%)
• 이달 습관 달성률
• 각 습관별 실천 일수 + 퍼센트 + 프로그레스 바

⑤ 미지정 할일 보관함 (Backlog)
• 날짜 없음으로 분류된 할일 목록
• 할일을 특정 날짜로 배정하거나 계속 보관 가능
• 우선순위 or 카테고리 태그 표시 (선택)

3. 핵심 컴포넌트 상세
PLAN / DO 타임블록
이 앱의 가장 중요한 UI 요소입니다.
• 시간축: 세로 타임라인 (30분 단위 눈금)
• PLAN 블록: 연한 골드/베이지 계열 블록, 내부에 할일명 표시
• DO 블록: 진한 다크 계열 블록, 실제 수행 시간 표시
• 두 블록이 같은 행에 나란히 시각적으로 비교 가능하게 배치
• 차이가 클수록 색상 강조 (선택 사항)

타이머
• 할일 항목 우측에 ▶ 타이머 버튼
• 실행 중: 경과 시간 카운트업 표시, 빨간 정지 버튼
• 종료 시: DO 필드에 시작~종료 시간 자동 저장
• 여러 개 동시 실행 불가 (하나만 활성화)

브레인스토밍 → 할일 분배
• 브레인스토밍 텍스트 영역에서 줄 단위로 항목 파싱
• 각 항목 옆에 '→ 할일 추가' 버튼 or 드래그 핸들
• 할일 목록으로 이동 or 타임블록에 직접 배치 가능

할일 상태 옵션
완료  /  미루기(날짜 재지정)  /  취소  /  날짜 미지정(보관함 이동)

4. 디자인 가이드
컬러 팔레트
• 배경: #FAF8F5 (크림 오프화이트)
• 섹션 배경: #F0EBE3 (따뜻한 베이지)
• 포인트: #C8A97E (웜 골드)
• 메인 텍스트: #2D2D2D
• 서브 텍스트: #888888
• PLAN 블록: #F5E6CC (연한 골드)
• DO 블록: #2D2D2D (다크)
• 위험/취소: #E05C5C
• 미루기: #5B8FE0

타이포그래피
• 한국어 기준 설계 (Pretendard 또는 Apple SD Gothic Neo)
• 날짜/타이틀: Bold 22~28px
• 섹션 레이블: 12px, 대문자, 골드 컬러
• 본문: 14px
• 서브: 12px

레이아웃
• 모바일(375px): 단일 컬럼, 하단 탭 네비게이션 (일간 / 캘린더 / 주간 / 월간 / 보관함)
• 데스크탑(1440px): 좌측 사이드바(캘린더 + 네비) + 메인 콘텐츠 영역 + 우측 패널(주간/월간 목표)
• 카드형 섹션, 둥근 모서리(12px), 부드러운 그림자

5. Figma AI 요청 문구
아래 텍스트를 Figma AI 프롬프트에 그대로 붙여넣으세요.

[ 모바일 요청문 — 375px 프레임 ]
Design a mobile productivity app UI at 375px width (iPhone), called "My Planner".
Color palette: cream off-white background #FAF8F5, warm beige sections #F0EBE3, gold accent #C8A97E, dark text #2D2D2D. Minimal, calm, premium feel.
Bottom tab navigation: Daily / Calendar / Weekly / Monthly / Backlog.
Design these 5 screens:
1. DAILY: Date header, Top 3 tasks (gold badges), vertical timetable with PLAN bars (light gold #F5E6CC) and DO bars (dark #2D2D2D) side by side for time comparison, todo list with timer button (records actual start/end time into DO field), habit chips, brainstorm textarea.
2. CALENDAR: Month/Week/Day tabs. Month view with dot indicators. Week view with 7-day timetable showing PLAN/DO blocks side by side. Drag to assign tasks to time blocks.
3. WEEKLY: 7-day mini grid with done/total count, weekly goals list with progress bar. Weekly goals are sub-goals of monthly goals.
4. MONTHLY: Monthly goals with progress bar (completion rate auto-calculated from weekly sub-goals), habit completion rate bars per habit.
5. BACKLOG: List of undated tasks, assign to date or keep in backlog. Filter by category tag.
Todo items have 4 states: complete / snooze (reassign date) / cancel / undate (move to backlog). Use rounded cards (12px), soft shadows, Pretendard font.

[ 데스크탑 요청문 — 1440px 프레임 ]
Design a desktop productivity app UI at 1440px width, called "My Planner".
Color palette: cream off-white background #FAF8F5, warm beige sections #F0EBE3, gold accent #C8A97E, dark text #2D2D2D. Minimal, calm, premium feel.
3-column layout: left sidebar (240px) with mini calendar + nav links, center main content (flexible), right panel (320px) with weekly/monthly goals.
Design these 5 screens (same content as mobile but optimized for wide layout):
1. DAILY: Two-column center area — left: todo list + brainstorm, right: vertical timetable with PLAN bars (light gold) and DO bars (dark) shown side-by-side per task for comparison. Timer button on each task.
2. CALENDAR: Full-width weekly view with horizontal time axis, PLAN and DO blocks per task in each day column. Month view as grid with dot indicators.
3. WEEKLY: 7-day summary row at top, weekly goals with progress bar in main area, habit streak indicators.
4. MONTHLY: Monthly goals with nested weekly sub-goals, progress bar auto-calculated from sub-goal completion, habit rate bars.
5. BACKLOG: Table view of undated tasks with columns: task name, category, created date, action (assign date / keep). Use rounded cards, soft shadows, Pretendard font.
