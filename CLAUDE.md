# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build → dist/
```

No test runner or linter is configured in this project.

## Architecture

### Tech Stack
- **React 18** + **TypeScript** + **Vite 6**
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin)
- **React Router v7** for routing
- **React Context API** for global state (no Redux/Zustand)
- **Radix UI** primitives + **shadcn/ui** components in `src/app/components/ui/`
- **PWA**: service worker registered in `usePWA.ts`, manifest at `public/manifest.json`

### Application Bootstrap
```
index.html → src/main.tsx → App.tsx
  ThemeProvider (ThemeContext.tsx)
    → PlannerProvider (store.tsx)
      → RouterProvider (routes.tsx)
        → RootLayout → Layout or LayoutC
          → Route views
```

### State Management
All global state lives in `src/app/store.tsx` via `PlannerProvider` / `usePlanner()`. State is in-memory only (no localStorage persistence currently). Data models include: `Todo`, `Event`, `Habit`, `Routine`, `Project`, `Milestone`, `Goal`, `Review`, `BrainstormItem`, `SelfCareRecord`, `Tag`.

### Theme System
Four design themes (A, B, C, D) defined in `src/styles/theme.css` as CSS custom properties. Themes A/B/D use a sidebar layout (`Layout.tsx`), theme C uses a top-nav layout (`LayoutC.tsx`). `RootLayout.tsx` switches between them. Theme state is managed in `ThemeContext.tsx`.

### Routing
13 routes defined in `routes.tsx` (root route 포함). All views are under a single parent layout. Key routes: `/dashboard`, `/daily`, `/calendar`, `/todos`, `/weekly`, `/goals`, `/projects`, `/projects/:id`, `/habits`, `/routines`(→ `/habits` redirect), `/selfcare`, `/reviews`.

### Path Alias
`@` resolves to `./src` (configured in `vite.config.ts`).

### Styling Notes
- CSS is split across: `src/styles/index.css` (imports), `fonts.css` (CDN fonts: Pretendard, Noto Sans KR, DM Serif), `tailwind.css`, `theme.css`
- The app UI is in **Korean**
- Emotion (`@emotion/react`) is available for component-level CSS-in-JS alongside Tailwind

## 프로젝트 개요
- **이름:** My Planner PWA
- **목적:** 개인 생산성 + 자기관리 통합 앱
- **배포:** Vercel (PWA, iPhone 홈화면 추가 가능)

## 컬러 시스템
| 역할 | 색상 |
|------|------|
| 배경 | `#F5F0E8` |
| 카드 | `#FDFAF4` |
| 골드 | `#C4A882` |
| 코랄 | `#D4735A` |
| 그린 | `#6BAA7A` |

## 주요 기능
- **일간 페이지:** 타임라인 PLAN/DO 블록, 스톱워치 / 모바일에서는 📋할일·⏰타임라인 탭 전환
- **캘린더:** 월별/주별/일별 탭 / 주별·일별은 헤더 고정 + 타임라인 단일 스크롤
- **할일:** 상태관리, 중요표시, 태그
- **습관 트래커:** 칩 형태, 연속달성일
- **리뷰&기록:** 감정/감사/KPT/데일리리뷰
- **자기관리:** 운동/공부/케어 기록 통계
- **모바일 네비게이션:** 하단 5탭(대시보드·일간·캘린더·할일·습관&루틴) + 상단 햄버거 버튼 → 바텀 시트 오버레이(전체 페이지 접근), 활성 탭 골드 pill 강조
- **공통 확인 모달:** `ConfirmModal` — `window.confirm()` 대체, 위험 액션은 빨간 버튼, 일반은 골드 버튼

## 작업 원칙
- 답변은 항상 한국어로
- 컴포넌트 단위로 작업
- 기존 컬러/디자인 시스템 유지
- 폰트는 ThemeContext 역할 필드 또는 brand.ts만 사용. 하드코딩 폰트명은 pre-commit(lint:fonts)에서 차단됨. 신규 폰트 역할이 필요하면 먼저 ThemeContext+DESIGN.md에 등록 후 사용.
- **PC 레이아웃은 절대 건드리지 말 것** — 모바일 전용 수정은 Tailwind `lg:` prefix 사용 (e.g. `hidden lg:flex`, `px-3 lg:px-6`)
- 모바일 기준: 375px (iPhone), 하단 네비바 56px(`pb-16` 이미 적용됨)

## Supabase Realtime 필수 원칙
- **신규 기능은 반드시 Realtime을 포함해서 구현한다.**
- **기존 기능도 Realtime이 빠져 있으면 추가한다.**
- 목적: PC에서 입력하면 모바일에, 모바일에서 입력하면 PC에 즉시(새로고침 없이) 반영.
- 구현 패턴:
  1. Supabase에서 해당 테이블을 `supabase_realtime` publication에 등록
     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE 테이블명;
     ```
  2. 컴포넌트에서 `useRealtimeSync` 훅 사용 (`src/app/hooks/useRealtimeSync.ts`)
     ```ts
     const refresh = useCallback(() => { db.테이블.fetchAll().then(setState); }, []);
     useEffect(() => { refresh(); }, [refresh]);
     useRealtimeSync('테이블명', refresh);
     ```
  3. 전역 store(`store.tsx`)에 연동된 테이블은 store 내부 Realtime 구독에 추가한다.

## 단축 명령어

### "깃허브 저장해줘"
변경사항 `git add` → `git commit` → `git push` 순으로 진행한다.
- `git status`로 변경된 파일 확인 후 관련 파일만 스테이징
- 커밋 메시지에 **무엇을(what), 왜(why), 어떻게(how) 수정했는지** 명확히 작성
  - 형식: `type: 변경 내용 요약 (변경 전 → 변경 후, 이유)`
  - 예: `feat: 모바일 네비를 하단 5탭+상단 메뉴 오버레이로 정리 (핵심 이동 유지, 전체 접근성 보완)`
  - 예: `fix: window.confirm → ConfirmModal 교체 (브라우저 기본 다이얼로그 → 앱 디자인 통일)`
  - 예: `refactor: TimePicker 공통 컴포넌트로 분리 (11곳 중복 코드 제거)`

### `todo로 넣어줘: [내용]`
PROGRESS_LOG.md에서 오늘 날짜 섹션을 찾아서
📋 TODO 항목에 `- [ ] [내용]`을 추가한다.
오늘 날짜 섹션이 없으면 새로 만들고 추가한다.

### `/진행현황 저장해줘` (또는 `진행현황 기록`)
오늘 세션에서 작업한 내용을 요약해서 **수정된 코드 + PROGRESS_LOG.md + PROJECT_SPEC.md** 를 모두 GitHub에 push한다.

**① 수정된 코드 파일 커밋 (미push 파일이 있을 경우)**
- `git status`로 미커밋/미push 파일 확인
- 기능별로 커밋 분리 (예: UI 변경 / 버그 수정 / 리팩토링)
- 커밋 메시지에 **무엇을 왜 어떻게 수정했는지** 명확히 작성
  - 예: `feat: 모바일 네비를 하단 5탭+상단 메뉴 오버레이로 개선 (활성 pill 강조, 전체 메뉴 접근성 보완)`
  - 예: `fix: ProjectView 프로젝트 삭제 window.confirm → ConfirmModal 교체`

**② PROGRESS_LOG.md 업데이트 후 커밋**
- 완료된 TODO → ✅ 완료 섹션으로 이동 (`- [x]`로 변경)
- 새로 추가/수정/삭제한 기능 → 🛠 오늘 작업 내용에 기록

**③ PROJECT_SPEC.md 업데이트 후 커밋**
- 최종 업데이트 날짜 변경 (파일 상단)
- 새로 구현된 기능 → `## 4. 구현 완료된 기능 목록` ✅ UI/UX 기능에 추가
- 버그 수정 → `## 5. 미구현 또는 버그 있는 기능` 상태 갱신
- 신규 컴포넌트 → `## 6. 컴포넌트 구조도` 공통 컴포넌트에 추가
- 미구현 기능 해소 시 해당 행 제거 또는 상태 변경

**④ 최종 push**
- `git push` 로 모든 커밋을 원격에 반영
- 문서 커밋 메시지: `"docs: YYYY-MM-DD 진행현황 기록"`
