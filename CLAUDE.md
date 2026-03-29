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
13 routes defined in `routes.tsx`. All views are under a single parent layout. Key routes: `/dashboard`, `/daily`, `/weekly`, `/monthly`, `/calendar`, `/backlog`, `/projects`, `/projects/:id`, `/brainstorm`, `/habits`, `/selfcare`, `/reviews`.

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
- **모바일 하단 네비:** 4탭(홈·일간·캘린더·주간) + 메뉴 버튼 → 바텀 시트 오버레이(전체 페이지 접근), 활성 탭 골드 pill 강조
- **공통 확인 모달:** `ConfirmModal` — `window.confirm()` 대체, 위험 액션은 빨간 버튼, 일반은 골드 버튼

## 작업 원칙
- 답변은 항상 한국어로
- 컴포넌트 단위로 작업
- 기존 컬러/디자인 시스템 유지
- **PC 레이아웃은 절대 건드리지 말 것** — 모바일 전용 수정은 Tailwind `lg:` prefix 사용 (e.g. `hidden lg:flex`, `px-3 lg:px-6`)
- 모바일 기준: 375px (iPhone), 하단 네비바 56px(`pb-16` 이미 적용됨)

## 단축 명령어
- "깃허브 저장해줘" = 변경사항 `git add .` → `git commit` → `git push`
- 커밋 메시지는 변경한 기능 내용으로 자동 작성

### `todo로 넣어줘: [내용]`
PROGRESS_LOG.md에서 오늘 날짜 섹션을 찾아서
📋 TODO 항목에 `- [ ] [내용]`을 추가한다.
오늘 날짜 섹션이 없으면 새로 만들고 추가한다.

### `/진행현황 저장해줘` (또는 `진행현황 기록`)
오늘 세션에서 작업한 내용을 요약해서 **PROGRESS_LOG.md** 와 **PROJECT_SPEC.md** 를 모두 업데이트한다.

**PROGRESS_LOG.md 업데이트:**
- 완료된 TODO → ✅ 완료 섹션으로 이동 (`- [x]`로 변경)
- 새로 추가/수정/삭제한 기능 → 🛠 오늘 작업 내용에 기록

**PROJECT_SPEC.md 업데이트:**
- 최종 업데이트 날짜 변경 (파일 상단)
- 새로 구현된 기능 → `## 4. 구현 완료된 기능 목록` ✅ UI/UX 기능에 추가
- 버그 수정 → `## 5. 미구현 또는 버그 있는 기능` 상태 갱신
- 신규 컴포넌트 → `## 6. 컴포넌트 구조도` 공통 컴포넌트에 추가
- 미구현 기능 해소 시 해당 행 제거 또는 상태 변경

기록 후 GitHub에 commit + push한다. 커밋 메시지: "docs: YYYY-MM-DD 진행현황 기록"
