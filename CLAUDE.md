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
- **일간 페이지:** 타임라인 PLAN/DO 블록, 스톱워치
- **할일:** 상태관리, 중요표시, 태그
- **습관 트래커:** 칩 형태, 연속달성일
- **리뷰&기록:** 감정/감사/KPT/데일리리뷰
- **자기관리:** 운동/공부/케어 기록 통계

## 작업 원칙
- 답변은 항상 한국어로
- 컴포넌트 단위로 작업
- 기존 컬러/디자인 시스템 유지
