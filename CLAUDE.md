# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run render:check   # 렌더 하네스 — 실제 화면 스크린샷 + 자동 검사
```

No test runner or linter is configured in this project.

## 렌더 하네스 (`npm run render:check`) — UI 변경 시 필수

`scripts/render/` 에 상주하는 재사용 렌더 하네스. **빌드/린트가 통과해도 화면이 깨진 채
배포된 사례**(종일 레인이 격자 삼킴·드롭다운 클리핑·완료 체크박스가 재생 아이콘으로 바뀜·
목표 페이지 라벤더 도배)가 반복돼, 실제 렌더를 한 번 보고 넘어가도록 상주화했다.

- **동작**: Vite dev 서버로 실제 컴포넌트를 띄우되 `lib/supabase`·`lib/db`·`features/money/db` 를
  `scripts/render/mock-supabase.ts`·`mock-db.ts`·`mock-money-db.ts` 로 리다이렉트(run.mjs 의
  Vite 플러그인)해 네트워크/인증 없이 **시드 데이터**로 렌더한다. 사전 설치된 Chromium(playwright-core,
  `/opt/pw-browsers`)으로 스크린샷 + `getComputedStyle` 검사.
- **시드**: `mock-db.ts` — 완료/미완료/기간/늦음/태그유무/중요가 섞인 할일 17건 +
  일정·습관·회고·목표. 날짜는 브라우저 '오늘' 기준 동적 생성(`getLogicalToday` 정렬).
  머니는 feature-local db 라 `mock-money-db.ts` 로 분리 — 이번/지난 기간 거래(같은 날짜 3건 포함)·
  대소분류·외화/고정비 거래·통장·투자·카드·고정비·대출·목표·이번 기간 계획. 기간은 급여일 25일
  기준으로 '오늘'에서 계산해 항상 이번/지난 기간에 거래가 들어가도록 맞춘다.
- **대상**: 일간 / 할일 / 캘린더(주별·월별) / 리뷰(일간·주간·월간) / 목표 / 건강-컨디션 /
  머니(가계부·이전 기간·자산·투자·계획) × PC(1280)·모바일(390).
  머니의 `prev` 컷은 가계부 탭으로 되돌린 뒤 PeriodBar `‹` 를 누르고 화면 하단까지 스크롤해 찍는다
  — 요약·카테고리별 지출·최근 거래가 모두 선택 기간을 따라가는지(리스트만 전체 거래를 보여주던
  회귀) 확인용.
- **자동 검사(수치 리포트 + PASS/WARN/FAIL)**:
  1. **라벤더 잔여** — 기존 기준 재사용(`B>R && B>G && (B-G)>=8 && 모든 채널>220`).
     라일락은 하온 정체성이라 WARN(정보성). "늘어남"을 눈으로 확인하는 용도.
  2. **요소 클리핑/뷰포트 이탈** — 팝오버·드롭다운이 `overflow:hidden` 부모에 갇히거나
     뷰포트를 벗어나는지(FAIL 조건).
  3. **화면 붕괴** — `#root` scrollHeight < 200px(빈 화면)이면 FAIL. 이 앱은 PC/모바일
     이중 트리(`hidden lg:block`/`lg:hidden`)라 숨은 `<main>` 은 높이 0 → 보이는 main 으로 측정.
- **산출물**: `scripts/render/output/<viewport>-<route>.png` + `report.json`(gitignore).
- **부분 실행**: `node scripts/render/run.mjs --route=daily,todos`.
- **규칙**: **UI 를 바꾸는 모든 작업은 `render:check` 를 돌리고 스크린샷을 보고에 첨부한다.**
  "정적 검증으로 대체"는 하네스가 실제로 실패할 때만 허용하며 그 경우 실패 로그를 함께 제출한다.

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
- 폰트는 `t.font*` 역할 필드 또는 brand.ts만 사용. 컴포넌트에서 폰트명 하드코딩 및 `var(--font-*)` 직접 소비 금지(일기 본문 `--font-diary`는 DiaryView 내 예외). pre-commit(lint:fonts)에서 차단됨. 신규 폰트 역할은 ThemeContext+DESIGN.md에 선등록 후 사용.
- **라일락(라벤더) 색은 `lint:colors` 가드로 관리됨** — pre-commit(`lint:colors`)에서 차단. 전면 금지가 아니라 **"늘어남"을 막는다**(라일락은 하온 정체성). 규칙: ① `t.lavenderTint`/`t.lavenderHover` 소비는 파일별 baseline(`scripts/color-baseline.json`) 초과 시 실패 — 기능면은 `t.surfaceMuted`, 입력칸은 `inputBg(t)`로(DESIGN.md §5), 정말 선택·활성·강조면 라인에 `// lint-colors-ok: 사유` 주석(사유 필수). ② 라벤더 hex(`#F4E7FB` 등)·`purple/violet/fuchsia` Tailwind 하드코딩 금지(토큰 우회). 카테고리색(`--cat-*`)은 정당한 라일락이라 대상 아님. 페이지 청소로 소비가 줄면 `npm run lint:colors -- --update`로 baseline을 조인다.
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

## 민감 사진(body_photos) 취급 규칙
눈바디(몸 사진)는 **민감 정보**다. 아래 규칙을 예외 없이 지킨다.
- **비공개 저장 전용**: `body-photos` 버킷은 `public=false`. 공개 read 정책을 만들지 않는다.
  테이블 RLS·스토리지 정책 모두 owner uid 게이트(`auth.uid()` 기반). 다른(공개) 버킷 관용구를
  복사해오지 않는다.
- **서명 URL 영속 저장 금지**: 표시 시점에만 `createSignedUrl(s)`로 발급(TTL 1h). 발급된 서명 URL을
  DB·localStorage·persist state 등 **세션을 넘기는 어떤 곳에도 저장하지 않는다**. 테이블에는
  `photo_path`(스토리지 경로)만 저장한다. (오프라인 미지원 = v1 허용)
- **외부 API 전송 금지**: body_photos 이미지·`photo_path`·서명 URL을 **어떤 외부 API로도 보내지
  않는다**(vision-extract/OpenAI 포함). 캡처는 **단순 file input**만 쓰고, `capture/PhotoCaptureSheet`
  (vision-extract로 이미지를 외부 전송하는 경로)는 **재사용 금지**.
- **리포트/공개 노출 금지**: Discord·일일 리포트 등 **어떤 리포트/공개 쿼리에도 body_photos를 추가하지
  않는다**.
- **삭제 무결성**: `storage.remove(path)` **성공 시에만** row를 삭제한다(스토리지 삭제 실패 시 row 유지
  → 고아 방지).

## 통계·비교 원칙 (폴백 ≠ 비교)
- **폴백 순서(가용성 해결)를 통계(비교가능성)에 재사용하지 않는다.** "이 사진/이 칸에 붙일 값을 아무거나
  하나 찾아라"(폴백, 예: 눈바디 뱃지 아침→저녁→기타)와 "비교 가능한 두 수를 맞대라"(통계)는 목적이 다르다.
- **통계는 항상 동일 slot 쌍으로 비교한다** — 기준 slot(예: 아침) 기록이 있는 날끼리만 비교하고, 기준 slot
  이 없는 날은 건너뛴다(같은 날 다른 slot 으로 바꿔치기 금지). 비교 대상이 없으면 값을 만들지 말고 "—" + 사유.
- **기준을 UI에 명시한다** — 어떤 slot 기준으로 계산했는지 라벨로 노출한다(숨기지 않는다). (몸무게 통계 카드
  세부 규칙은 DESIGN.md §7.4.)

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
