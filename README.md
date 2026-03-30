# My Planner PWA

개인 생산성 + 자기관리 통합 PWA입니다.  
React + TypeScript + Vite 기반이며, 전역 상태는 React Context, 데이터 저장은 Supabase를 사용합니다.

## 실행 방법

```bash
npm install
npm run dev
npm run build
```

- 개발 서버: `http://localhost:5173`
- 프로덕션 빌드 결과물: `dist/`

## 환경 변수

Supabase 연결을 위해 아래 값이 필요합니다.

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

실제 클라이언트 생성은 `src/lib/supabase.ts`에서 이뤄집니다.

## 기술 스택

- React 18
- TypeScript
- Vite 6
- React Router v7
- Tailwind CSS v4
- Radix UI + shadcn/ui
- Supabase
- date-fns
- @dnd-kit/core

## 앱 시작 흐름

```text
index.html
→ src/main.tsx
→ src/app/App.tsx
  → ThemeProvider
  → PlannerProvider
  → RouterProvider
  → RootLayout
  → Layout / LayoutC
  → 각 페이지 컴포넌트
```

추가로 `App.tsx`에서 아래 전역 UI도 같이 마운트됩니다.

- `GlobalFloatingTimer`
- `PWABanner`
- `IOSInstallGuide`

## 디렉토리 구조

```text
src/
├─ main.tsx                      # React 엔트리
├─ styles/                       # 전역 스타일, Tailwind, 테마 토큰
├─ lib/
│  ├─ supabase.ts                # Supabase client 생성
│  └─ db.ts                      # 테이블별 fetch/upsert/delete 래퍼
└─ app/
   ├─ App.tsx                    # 앱 최상위 조립
   ├─ routes.tsx                 # 라우트 정의
   ├─ store.tsx                  # 전역 상태 + 액션 + 초기 데이터 로드
   ├─ ThemeContext.tsx           # 디자인 테마 / 레이아웃 모드
   ├─ hooks/                     # PWA, 알림 훅
   └─ components/
      ├─ Layout.tsx              # 기본 레이아웃 (사이드바)
      ├─ LayoutC.tsx             # 테마 C 전용 탑네비 레이아웃
      ├─ RootLayout.tsx          # 레이아웃 선택기
      ├─ *View.tsx               # 실제 페이지 컴포넌트
      └─ ui/                     # 공통 UI primitives
```

## 라우팅 구조

실제 라우팅 기준 파일은 `src/app/routes.tsx`입니다.

| 경로 | 컴포넌트 | 설명 |
|------|---------|------|
| `/` | redirect | `/dashboard`로 이동 |
| `/dashboard` | `DashboardView` | 대시보드 |
| `/daily` | `DailyView` | 일간 |
| `/calendar` | `CalendarView` | 캘린더 |
| `/todos` | `TodosView` | 전체/미지정 할일 |
| `/weekly` | `WeeklyView` | 주간 칸반 + 주간 목표 |
| `/goals` | `MonthlyView` | 목표관리 |
| `/projects` | `ProjectsView` | 프로젝트 목록 |
| `/projects/:id` | `ProjectDetailView` | 프로젝트 상세 |
| `/habits` | `HabitsView` | 습관 + 루틴 탭 |
| `/routines` | redirect | `/habits`로 이동 |
| `/selfcare` | `SelfCareView` | 자기관리 |
| `/reviews` | `ReviewsView` | 리뷰 & 기록 |

참고:
- `BrainstormView.tsx`, `BacklogView.tsx` 파일은 남아 있지만 현재 라우터에는 연결되어 있지 않습니다.

## 상태 관리

전역 상태는 `src/app/store.tsx`의 `PlannerProvider` / `usePlanner()`를 사용합니다.

관리되는 대표 상태:
- `todos`
- `events`
- `habits`
- `projects`
- `milestones`
- `weeklyGoals`
- `monthlyGoals`
- `tags`
- `routines`
- `reviewRecords`
- `weeklyReviews`
- `monthlyReviews`
- `timelineLogs`
- `selectedDate`
- `activeTimer`

구조적 특징:
- 앱 시작 시 `store.tsx`에서 Supabase 데이터를 병렬 로드
- 각 페이지는 `usePlanner()`로 상태/액션을 직접 사용
- 수정 시 UI state를 먼저 갱신하고, 바로 `db.ts`를 통해 Supabase에 반영

## 데이터 접근 구조

```text
컴포넌트
→ usePlanner() 액션 호출
→ store.tsx
→ src/lib/db.ts
→ src/lib/supabase.ts
→ Supabase
```

`db.ts`는 테이블별로 아래 형태를 제공합니다.

- `fetchAll()`
- `upsert()`
- `delete()`

현재 코드에서 연동 중인 주요 테이블:
- `todos`
- `habits`
- `projects`
- `milestones`
- `self_care_records`
- `review_records`
- `timeline_logs`
- `user_settings`
- `events`
- `weekly_goals`
- `monthly_goals`
- `brainstorm_items`
- `brainstorm_memos`
- `tags`
- `routines`

주의:
- `weeklyReviews`, `monthlyReviews`는 아직 Supabase 테이블 없이 메모리 상태입니다.

## 테마 / 레이아웃

테마 상태는 `src/app/ThemeContext.tsx`에서 관리합니다.

- 테마 A/B/D: `Layout.tsx` 사용
- 테마 C: `LayoutC.tsx` 사용

모바일/데스크탑 차이:
- 데스크탑: 사이드바 또는 탑네비 레이아웃
- 모바일: 하단 5탭 네비 + 상단 햄버거 메뉴 오버레이 (`Layout.tsx`)

## 주요 페이지 역할

- `DashboardView`: 통계, 오늘 습관, Top3, 요약 카드
- `DailyView`: PLAN/DO 타임라인, 할일 CRUD, 타이머, 타임라인 로그
- `CalendarView`: 월/주/일 뷰, 필터 탭
- `TodosView`: 날짜별 그룹 + 미지정 할일 관리
- `WeeklyView`: 미지정 할일 패널, 주간 칸반, 주간 목표
- `MonthlyView`: 목표관리 탭(주간/월간 목표)
- `HabitsView`: 습관 5종 유형 + 루틴 탭
- `ProjectView`: 프로젝트/마일스톤 관리
- `ReviewsView`: 일간/주간/월간 리뷰
- `SelfCareView`: 운동/공부/케어 기록 및 통계

## UI 수정할 때 먼저 볼 파일

레이아웃/네비 수정:
- `src/app/components/Layout.tsx`
- `src/app/components/LayoutC.tsx`
- `src/app/components/RootLayout.tsx`

전역 상태/데이터 수정:
- `src/app/store.tsx`
- `src/lib/db.ts`
- `src/lib/supabase.ts`

스타일/테마 수정:
- `src/app/ThemeContext.tsx`
- `src/styles/index.css`
- `src/styles/theme.css`

페이지 UI 수정:
- `src/app/components/*View.tsx`

공통 UI 수정:
- `src/app/components/ui/`
- `src/app/components/ConfirmModal.tsx`
- `src/app/components/TodoModal.tsx`
- `src/app/components/TimePicker.tsx`

## PWA / 알림

관련 파일:
- `src/app/hooks/usePWA.ts`
- `src/app/components/PWABanner.tsx`
- `src/app/hooks/useNotification.ts`
- `src/app/components/NotificationPermissionBanner.tsx`
- `public/manifest.json`
- `public/sw.js`

현재 상태:
- manifest 연결됨
- service worker 등록됨
- 기본 `network-first + cache fallback` 동작 있음
- 로컬 알림은 할일 `planStart` 기준으로 동작
- 고급 오프라인 동기화 전략은 아직 없음

## 함께 보면 좋은 문서

- `PROJECT_SPEC.md`: 기능 명세 / 컴포넌트 구조 / DB 구조
- `PROGRESS_LOG.md`: 날짜별 작업 이력
- `CLAUDE.md`: 작업 원칙과 프로젝트 컨텍스트
  