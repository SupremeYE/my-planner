---
# ─────────────────────────────────────────────
#  HAON DESIGN SYSTEM  (machine-readable tokens)
#  style: Soft Pastel — Solid Elevation (glass on overlays only)
#  version: 1.1
# ─────────────────────────────────────────────
name: Haon Design System
version: "1.1"
style: Soft Pastel / Solid Elevation (hybrid glass)
mood: [soft, airy, pastel, rounded, calm, premium, legible, dimensional]

colors:
  # Core pastel palette
  lavender-mist: "#F4E7FB"
  warm-cream: "#F2DDDC"
  soft-coral: "#F6BCBA"
  orchid-pink: "#E3AADD"
  lilac-purple: "#C8A8E9"
  periwinkle: "#C3C7F4"
  # Accents
  coral-vivid: "#FF9A8B"
  pink-vivid: "#FF6F91"
  deep-indigo: "#2E2A5B"
  # Text
  text-primary: "#2E2A5B"
  text-secondary: "#6E6A93"
  text-muted: "#A5A2BE"
  text-on-dark: "#FFFFFF"
  # Semantic
  success: "#4E9E6E"
  warning: "#F6C177"
  info: "#9BB4F4"
  danger: "#F58A8A"

background:
  base: "#FBF8FC"
  # Soft radial blobs on a near-white canvas (NOT a linear 3-stop sweep — that reads "AI-generated")
  canvas: "radial-gradient(1200px 600px at 15% 0%, rgba(200,168,233,0.20), transparent 60%), radial-gradient(1000px 700px at 100% 100%, rgba(246,188,186,0.18), transparent 55%), #FBF8FC"

surfaces:
  # DEFAULT for all content: solid, opaque, elevated by shadow (no transparency)
  solid-card:
    bg: "#FFFFFF"
    border: "1px solid rgba(122,92,162,0.12)"
    shadow: "0 8px 20px rgba(120,90,160,0.12)"
    radius: "20px"
  solid-row:
    bg: "#FFFFFF"
    border: "1px solid rgba(122,92,162,0.10)"
    shadow: "0 6px 16px rgba(120,90,160,0.10)"
    radius: "14px"
  # GLASS is reserved for OVERLAYS ONLY (sticky top bar, modals, popovers, dropdowns, toasts, FAB menus)
  glass-overlay:
    bg: "rgba(255,255,255,0.60)"
    backdrop: "blur(20px) saturate(150%)"
    border: "1px solid rgba(255,255,255,0.60)"
    edge: "inset 0 1px 0 rgba(255,255,255,0.85)"
    shadow: "0 8px 24px rgba(120,90,160,0.14)"

gradients:
  primary-button: "linear-gradient(135deg, #FF9A8B 0%, #FF6F91 100%)"
  nav-active: "linear-gradient(135deg, #FF9A8B 0%, #FF6F91 100%)"
  chart-area-fill: "linear-gradient(180deg, rgba(255,111,145,0.30) 0%, rgba(255,111,145,0) 100%)"

typography:
  primary: "Pretendard, -apple-system, 'Segoe UI', Roboto, sans-serif"
  numeric: "Sora, Pretendard, sans-serif"
  diary: "'Ownglyph-Positive', 'Pretendard', sans-serif"
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700 }
  roles:
    page-title:      { family: primary, weight: 700, size: "26-30px", tracking: "-0.02em" }
    section-heading: { family: primary, weight: 600, size: "18-22px" }
    card-title:      { family: primary, weight: 600, size: "16-18px" }
    body:            { family: primary, weight: 400, size: "14-15px", line-height: 1.5 }
    label-button:    { family: primary, weight: 500, size: "12-14px" }
    numeric-large:   { family: numeric, weight: 600, size: "22-32px" }
    diary-body:      { family: diary,   weight: 400, size: "15-17px", line-height: 1.8 }

radius: { sm: "10px", md: "14px", lg: "20px", xl: "24px", pill: "9999px" }

tags:
  # Filled pastel chip (NOT a low-opacity wash) + a left accent bar on the tagged row
  chip-by-hue: { work: "#DCE3FB", personal: "#EAE0FA", health: "#FBE1EC" }
  chip-text: "darker sibling of the hue (e.g. #4A56A0)"
  row-left-accent: "3px solid <tag hue>"

timeline:
  # PLAN and DO keep DISTINCT default hues (per product design); tag colors override on top.
  plan-default-bg: "rgba(200,168,233,0.32)"
  plan-default-border: "rgba(150,120,200,0.45)"
  do-default-bg: "keep the distinct DO hue, toned to pastel"
  block-text: "#4A3E6B"
  block-border-emphasis: "give blocks a slightly stronger border so they read against the light grid"
  now-line: "#FF9A8B"

breakpoints: { mobile: "<768px", desktop: "lg (>=1024px)" }
---

# Haon Design System — DESIGN.md (v1.1)

Single source of truth for every visual decision in Haon. Read this before any UI work
and match the tokens, type scale, surface rules, and component patterns here. Never
hardcode colors, fonts, radii, or shadows — reference the tokens (implemented as
Tailwind v4 `@theme` + CSS variables). Haon is a Korean personal life-planner PWA
(React + Vite + TS + Tailwind v4 CSS-first + Supabase + Vercel).

Style: **Soft Pastel with Solid Elevation.** Content sits on a soft near-white pastel
canvas as opaque, elevated cards. Transparency (glass) is reserved for overlays only.

---

## 1. Surface model (the core rule)

Two surface types, and it matters which is which:

**Solid (default — all content).** Content cards, list rows, the quick-capture box,
record cards, banners — everything the user reads — are opaque white, lifted off the
canvas by a soft colored shadow plus a hairline border. **No `backdrop-filter` on
content surfaces.** On a near-white canvas, blur has nothing to refract; the shadow +
border do the separating. This is what keeps dense, text-heavy screens legible.

**Glass (overlays only).** The sticky top date bar (once it floats over scrolling
content), modals, popovers, dropdowns, toasts, and FAB menus use the `glass-overlay`
recipe: semi-transparent white + `backdrop-filter: blur(20px) saturate(150%)` + a
bright top edge highlight + soft shadow. Glass appears when there IS content behind it
to blur — which is exactly when overlays are shown.

Rule of thumb: if it scrolls WITH the page, it's solid. If it floats OVER the page,
it can be glass.

---

## 2. Background canvas

Near-white base `#FBF8FC` with two soft radial blobs (lilac top-left, coral
bottom-right). Do NOT use a linear 3-stop purple→pink→peach sweep — that reads as an
"AI-generated wallpaper." Keep the canvas quiet; the pastel identity lives in the
blobs, the accents, and the charts, not in loud backgrounds.

---

## 3. Color usage

- Primary action → `gradients.primary-button` (coral→pink). Active nav item → same gradient pill.
- Text: `text-primary` body, `text-secondary` supporting, `text-muted` hints/empty states. Never pure black.
- Accent restraint: keep most of a screen calm; give strong color to ONE focal element (e.g. the main "오늘 할 일" card or the primary CTA), not everywhere.
- Semantic status: `warning` (`#F6C177`) = **임박·주의** 강조 (마감 임박 dueSoon, 주의 상태) — `danger`와 구분한다 (**danger** = 위험·삭제 등 파괴적/실패, **warning** = 임박·주의로 아직 되돌릴 수 있는 경고). 하드코딩 앰버(예: `#E0A030`) 금지, `t.warning`/`t.warningLight` 토큰만 사용.

### 카테고리 색 (앱 공통 — 캘린더 + QuickCapture 공유)

App-wide **shared** category tokens: identical everywhere a category appears — 캘린더
day-cell dots, 캘린더 필터 칩, and the home QuickCapture type chip all read the SAME set, so
the calendar and the chip never drift. Registered once here (confirmed — Option B: sage
자기관리 + 일정 unified to blue). Each category has a pale **fill** (chip bg, subtle row tint)
and a saturated **dot / left-accent** (day-cell dot); derive intermediate tints with `mixHex`,
do not hand-pick extra hexes.

| 카테고리 | hue | dot | fill |
|---|---|---|---|
| 할일 (todo) | 라일락 lilac | `#9E6FD6` | `#C8A8E9` |
| 일정 (schedule) | 블루 blue | `#7B82E3` | `#C3C7F4` |
| 습관 (habit) | 마젠타 magenta | `#C56FB8` | `#E3AADD` |
| 자기관리 (self-care) | 세이지 sage | `#6BAA7A` | `#CFE3CE` |

- **세이지 (`#6BAA7A`)** — reused from the existing Haon warm tokens (not net-new), now
  registered as a **category-only hue** in the palette.
- **QuickCapture 칩 일정색 확정: 코랄 → 블루.** The 일정 type chip moves off coral to the
  category 블루 above (resolves coral overload); 할일 stays 라일락. See §5 (Quick-capture type chip).
- **코랄은 카테고리 색으로 쓰지 않는다** — coral (`accent_gradient`) is reserved for
  emphasis / FAB / the selected-day tint only, never a category.

---

## 4. Typography

> **스코프 계약 (중요).** 폰트 규칙의 단일 기준(SSOT)은 이 §4/§8 이다 (CLAUDE.md 는 참조만
> 하고 규칙을 중복 정의하지 않는다). 다만 **§4/§8 의 폰트 규정은 테마 H 전용 계약**이다.
> 역할(page-title/section/body/label/numeric/diary/decorative)→폰트 매핑은 **테마별로 선언**되며,
> 그 per-theme 값은 `ThemeContext.tsx` 의 `ThemeTokens.fontPageTitle` 등 역할 필드가 보유한다.
> 테마 H 는 아래 표(Pretendard/Sora/Ownglyph)를 그대로 따르고, 다른 테마(A/B/C/D)는 각자의
> 기존 폰트 정체성(예: B 는 제목 DM Serif·본문 Gowun Dodum)을 **그대로 보존**한다. 즉 §4 를
> 전역 적용해 다른 테마의 DM Serif/GmarketSans/손글씨를 제거하는 것이 아니다. `@theme` 의
> `--font-page-title` 등 CSS 역할 토큰은 이 H 계약 기준값을 담는다.

Fonts (테마 H 기준): H = 제목(page-title/section/card-title) **GmarketSans**, 본문·라벨
**Pretendard**, 숫자 **Sora**, 일기 **Ownglyph**. 카드제목은 `fontSection` 을 공유하므로
제목 계열(GmarketSans)로 함께 수렴하고, 본문·입력·라벨만 Pretendard 로 통일한다(full Hangul + Latin).
**Sora** for emphasis numbers. **온글잎 긍정 (Ownglyph-Positive)** for diary
body text ONLY (deliberate handwriting exception; never elsewhere).
<!-- 실렌더 검토 결과 H 제목은 Gmarket 채택(v1.x). -->

Weight → role (use only these four; avoid 100–300 and 800–900):

| Role | Font | Weight | Size |
|---|---|---|---|
| Page title | GmarketSans | 700 | 26–30px |
| Section heading | GmarketSans | 600 | 18–22px |
| Card title | GmarketSans (fontSection 공유) | 600 | 16–18px |
| Body / input | Pretendard | 400 | 14–15px |
| Label / button / chip | Pretendard | 500 | 12–14px |
| Emphasis number | Sora | 600 | 22–32px |
| Diary body (exception) | Ownglyph-Positive | 400 | 15–17px |

#### 확장 역할 — 테마별 선언 (Stage 1.95)

위 표(H 계약)에 더해, 앱은 아래 5개 확장 역할을 둔다. 스코프 계약과 동일하게
**H = Pretendard/Sora, A/B/C/D = 기존 정체성 보존**이다. 각 값은
`ThemeContext.tsx` 의 역할 필드(`fontReading` 등)가 보유하며, 컴포넌트는 리터럴이
아니라 이 필드를 참조한다(치환은 Stage 2). 등록만 된 상태이며 소비처는 아직 없다.

| Role (필드) | 용도 | A / B / C / D | H (계약) |
|---|---|---|---|
| `fontReading` | 독서·구절 명조 본문 | `'Georgia', 'Noto Serif KR', serif` | Pretendard |
| `fontBrand` | 스플래시·로그인·로고 브랜드 명조 | `'Gowun Batang', serif` | Pretendard |
| `fontQuote` | 확언·태그라인 감성 본문 | `'Gowun Dodum', 'Pretendard', sans-serif` | Pretendard |
| `fontDecoratePen` | 손글씨 장식(펜) | `'Nanum Pen Script', cursive` | Pretendard (§8 폴백) |
| `fontStat` | 디스플레이 통계 숫자(%·연도) | `'DM Serif Display', serif` | `'Sora', 'Pretendard', sans-serif` |

참고: 기존 `fontDecorative`(장식 손글씨)는 A/B/C/D = `'Gaegu', cursive`, H = Pretendard(§8 폴백).

브랜드 마크(로고 워드마크·스플래시·로그인/재설정 타이틀)는 테마 독립 브랜드 상수(`src/app/styles/brand.ts` — Gowun Batang)를 따르며, 앱 UI 가 아니라 브랜드 정체성이므로 §4 UI 폰트 규정(테마별 역할 필드) 대상이 아니다. 테마 H 에서도 브랜드 마크는 Pretendard 로 바뀌지 않는다.

### Font loading
- **Pretendard** — CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css`
- **Sora** — Google Fonts.
- **Ownglyph-Positive** — NOT on any CDN. Self-hosted from a provided `.ttf`: convert to `.woff2` (`fonttools` + `brotli`; if the environment can't, stop and report), place in `public/fonts/`, register `@font-face` family `Ownglyph-Positive` with `font-display: swap`, apply to diary body only. License: free for commercial/web embedding (Ownglyph/VoyagerX); do not modify or redistribute the file.

---

## 5. Components

- **Card** — `solid-card` recipe. Radius 20–24px. Record cards use the same recipe (keep the border/shadow identical whether or not a record exists; only the inner text is muted in the empty state).
- **List row** — `solid-row` recipe. Leading star/icon, title (+ optional tag chip), trailing status pill + action. Tagged rows get a 3px left accent bar in the tag hue.
- **Quick-capture box** — `solid-card` recipe, opaque white. The "+" is a coral-gradient circle. (No heavy purple fill.)
- **Buttons** — one shared, **token-driven** recipe (never hardcoded hex). Common to all variants: radius 12–16px (pill for compact actions), label Pretendard 600 (§4), `opacity 0.45–0.5` when disabled. Variants:
  - **primary** (default filled action) — **solid `t.accent`** fill, white text, soft coral shadow. Solid is the baseline: a full coral→pink **gradient fill reads as "loud"** (same call already made for tabs/banners). The gradient is an **emphasis-only option** for select accents (e.g. FAB, a hero CTA), implemented as `t.primaryGradient ?? t.accent`.
  - **secondary** — `t.accentLight` fill + `t.accent` text + `1px solid t.border` (use `t.accent` for a stronger outline). The standard 취소 / 보조 action.
  - **ghost / text** — tint only (`t.accentLight`, or `accent` at ~10–15% alpha), no border, `t.accent` text; inline / low-emphasis actions. Bare icon-only buttons with no fill use `t.textMuted`.
  - **danger** (soft — reversible-looking risk) — `t.danger` text on `t.dangerLight` fill.
  - **dangerSolid** (destructive confirm) — solid `t.danger` fill, white text.
  - Modifiers (apply to any variant): **`leftIcon`** — a leading icon before the label (icon inherits the label color; keep the same gap for all sizes). **`loading`** — swaps `leftIcon` for a spinner in `currentColor`, disables the button, and sets `aria-busy` (label stays so width doesn't jump).
  - ⚠️ **Off-palette hardcoded button colors are prohibited** — recover them into the variants/tokens above: slate-blue (`#515f74` / `#5B8FE0` / `#d5e3fd` / `#eef4fa`), hardcoded reds (`#DC2626` / `#ef4444` / `#E53E3E` / `#CC0000`), tan-wood (`#C4A882` / `#F5F0E8`), greens (`#6BAA7A` / `#dcfce7`). `ConfirmModal` (uses none of the tokens today) is the first recovery target.
- **Chip / tag** — pill; filled with a saturated pastel (`tags.chip-by-hue`) and a darker text sibling. Status pills (예정/완료) are small and soft.
- **Icon button** — circle 44–48px, pastel tinted background, icon in `text-primary`.
- **FAB** — circle **46px**, **solid coral (`t.accent`)**, white icon, soft shadow (matches the global add-FAB). Module-local FABs may be 56px but keep the coral fill. The primary **gradient emphasis-fill** option applies here (`t.primaryGradient ?? t.accent`).
- **Input** — `solid-card` fill, radius 12–14px, hairline border, placeholder `text-muted`.
- **Toggle** — pill track, coral (on), white knob.
- **Bottom nav (mobile)** — solid or glass floating bar; active item tinted/gradient.
- **Sidebar (desktop)** — left rail; active item = coral-gradient pill.
- **Segmented control (tabs / view toggles)** — app-wide **solid-elevation** segments: active = opaque white pill + soft shadow + deep-indigo 600 label + a **3px coral underline**; inactive = transparent + muted label; track = near-neutral low-saturation (NOT warm beige, NOT strong lilac). One pattern for todo-page tabs, goals/lifestyle tabs, and the 캘린더 뷰토글 (calendar specifics in §6.1).
- **Calendar** — 캘린더 상세(뷰 토글·필터 칩·멀티항목 day-cell·날짜 마커·바텀 시트 등)는 §6 (캘린더 페이지) 참조.
- **Timeline** — PLAN and DO blocks keep distinct pastel default hues (tags override); blocks get a slightly stronger border to read against the grid; the "now" line is soft coral `#FF9A8B`, not harsh red.
- **Selection mode / bulk-action bar** — list pages (할일 등) 다중 선택 + 일괄 액션 패턴. 규격은 아래 "Selection mode & bulk-action bar" 참조.

### Interaction states (apply to buttons, inputs, chips)
Default → Hover (slight lift: shadow +1 step, border darkens a touch) → Pressed
(scale 0.98) → Focus (coral focus ring, `0 0 0 3px rgba(255,111,145,0.25)`) →
Disabled (opacity 0.5, no shadow).

These states are **owned by the shared Button / SegmentedControl components** — the single
implementation site. They are largely un-implemented across today's hand-styled buttons; the
shared component is where they get built (a `buttonStyle(t, variant)` recipe supplies the static
per-variant color/shadow, the component layer adds hover/pressed/focus/disabled).

### Theming & scope (buttons)
Buttons are **token-driven, therefore theme-agnostic** — the same recipe serves all themes
(A/B/C/D/H) because every variant reads tokens (`t.accent`, `t.danger`, `t.accentLight`, …); **no
`isHaon` gating**. The primary gradient option falls back with `t.primaryGradient ?? t.accent`.
**Brand screens are excluded**: LoginView / ResetPasswordView and anything sourced from
`brand.ts` keep their brand identity and do NOT adopt the shared Button.

### Quick-capture type chip (smart emphasis pulse)
The quick-capture leading chip shows the entry type — colored with the shared **카테고리 색**
(할일 = 라일락, 일정 = 블루; 일정은 코랄→블루로 확정, §3 참조) — and is **tappable** to toggle
the type (caret ▾ affordance; type priority is
manual tap > keyword prefix `일정`/`할일` > default 할일). When the parser detects a
**time** but the type is still the default (할일) and the user has neither tapped nor
used a prefix, the chip gets a **smart-emphasis pulse**: a soft coral ring
(`accent`) that gently breathes to hint "this could be an 일정" — **no hint text, no
auto-conversion.** The ring color is the `accent` token (never hardcoded; injected as
an inline CSS var). Pulse spec: `box-shadow` ring `0 0 0 0` → `0 0 0 4px`, ~1.6s
ease-in-out, infinite. **`prefers-reduced-motion: reduce` → animation off, replaced by
a static `0 0 0 3px` ring.** Implemented as `.haon-type-pulse` in `haon.css`.

### Context add-action (추가 액션 — 한 매핑, 두 렌더링)

**One mapping, two renderings.** Each page has exactly ONE primary add affordance, and its
action follows the page's **primary entity** — a single source mapping (page → add-action), not
a per-surface guess. That one mapping renders two ways by breakpoint:
- **Mobile** — the floating **FAB** (§5 FAB; `fixed`, coral). Retained as-is.
- **Desktop (`lg:`)** — **no floating FAB.** A **"+ 추가" button in the content-column header**
  (title row, right slot), anchored INSIDE the content column so it never overlaps the 대시보드
  right rail in either the expanded (288px) or collapsed (64px) state (resolves ⑨c — the old FAB
  was `lg:absolute` with no positioned ancestor, so it anchored to the viewport and drew over the
  rail). **Scope: Theme H only, `lg:` only. Non-H themes (A/B/C/D) and mobile render unchanged.**

**Three add-action shapes** (pick per page from the mapping):
1. **바로 (direct)** — a single add action of ONE kind → open the add modal / sheet / inline form
   immediately, no chooser. Most pages (scrap, vision, projects, food, mood, books, …).
2. **바텀시트 / 팝오버 (chooser)** — several records of DIFFERENT kinds under one entry point →
   present the options. Mobile = bottom sheet (slide-up); desktop = a small popover/dropdown
   anchored under the header "+ 추가". Only for genuinely multi-kind record pages — currently
   **/health** (수면·컨디션·몸무게·생리·운동 "기록" actions only; setting-type items like 목표 are
   NOT put in the sheet).
3. **던지기입력 (throw-in)** — free-text capture → focus **QuickAddInput** directly (prefix parse
   `일정 ` / `할일 `, §5 Quick-capture chip; parser in `src/lib/quickParse.ts`). For /daily,
   /calendar, /todos — reuses the existing parse logic, no new branch.

**Page → shape mapping (single source of truth).** daily·calendar·todos = 던지기입력 / health =
바텀시트 (기록 액션만) / scrap·vision·projects·habits·food·mood·books·culture·recipes·places·selfcare
= 바로. Pages that today fall back to the generic 할일 throw-in because they registered no FabAction
(health, reviews, moments, diary, walk, goals) must register their OWN primary-entity action so the
affordance matches the page (health→기록 시트, reviews/moments/diary→바로 작성, walk→산책 시작,
goals→인라인). Register a page's shape here before wiring it.

**Bottom sheet spec (mobile chooser).** Slide-up from the bottom, **ease-out**, with a **backdrop
dim** behind; the FAB "+" **rotates to "×"** while open (tap-out or × dismisses). Surface = overlay
(glass allowed, §1) with a top drag handle and top-rounded corners. Options are "기록" actions only.

**Collapsed-rail icons.** With the desktop FAB moved into the header, the 대시보드 collapsed-rail
placeholder icons use **muted tokens** (`t.textMuted` on `t.accentSoft`), not `t.accent`/coral —
they are passive nav hints, not actions (⑨b; coral stays reserved for accent / FAB / selected-day,
§3). The interactive rail toggle button keeps a subtle neutral fill (`t.bgSub` / `t.textSub`).

**haonStyles helpers (register before build; definitions only — no consumers yet).**
`bottomSheetStyle` (mobile sheet surface), `sheetBackdropStyle` (dim backdrop), `addPopoverStyle`
(desktop "+ 추가" popover). The header "+ 추가" button reuses `buttonStyle(t, 'ghost')`
(accentLight/accent pill) — no new button helper. Placement (Stage 2) and per-page branching
(Stage 3) land later.

### Selection mode & bulk-action bar (list pages)
할일 등 리스트 페이지에서 여러 항목을 한 번에 처리하는 공통 다중 선택 패턴. 전 테마 공통(토큰
기반, `isHaon` 게이팅은 표면 recipe 에만).
- **진입/해제** — 페이지 헤더 우측의 "선택" 텍스트 토글(ghost/secondary variant, §5). 켜면 선택
  모드, 다시 누르거나 액션바의 "취소"로 해제. 해제 시 선택 집합은 비운다.
- **행 체크박스** — 선택 모드에서 각 행 **좌측**에 원형 체크박스. 미선택 = hairline `t.border`
  outline, 선택 = solid `t.accent` 채움 + 흰 체크(√). 상태 토글(완료) 버튼과 시각적으로 구분되게
  좌측 최선두에 둔다. 행 전체 탭 = 선택 토글(선택 모드일 때만; 평상시 탭 동작은 보존).
- **선택된 행** — `selectedRowStyle(t)`: 2px `t.accent` 링(`outline`, offset −2)을 기존
  `solidRowStyle`(H) / 카드(그 외) 위에 덧댄다. 배경·그림자는 건드리지 않음(링만 추가). 하드코딩 색 없음.
- **액션바** — 리스트 하단에 떠 있는 floating bar. `actionBarStyle(t)` 표면(오버레이라 H 에서
  글래스 허용 — §1). 좌측 "**N개 선택**" 카운트, 우측 일괄 액션: 삭제 = `danger` variant(§5),
  취소 = ghost/secondary. **파괴적 일괄 액션은 반드시 `ConfirmModal`(confirmDanger) 경유** — 개수를
  문구에 노출("N개를 삭제할까요?"). 선택 0개면 액션바 숨김.
- **토큰만** — 링·체크·바·버튼 전부 `t.accent` / `t.danger` / `t.border` / `t.accentLight`
  토큰. off-palette 하드코딩 색 금지(§5).
- **v1 범위** — 일괄 **삭제**만. 오늘로 이동·상태 일괄 변경 등은 후속 Stage.

### Period navigator (기간 네비게이터 — 달력 고정 기간 이동, 공용)

**One shared pattern** for calendar-anchored period browsing — replaces per-page rolling windows
(the old 몸무게 7일/30일/1년 롤링, and the sleep/컨디션 인라인 주 스테퍼). Two composed parts, **no new
segment visuals**:
1. **Range segments (주 / 월 / 년)** — reuse the app-wide **`<SegmentedControl>`** (§5): active =
   opaque white pill + soft shadow + deep-indigo 600 label + 3px coral underline; track = neutral
   low-sat. Composition only — do **not** register a new segment style.
2. **Period stepper `‹ [기간 라벨] ›`** — reuses the 수면 화면 stepper shape and §6.2 month-header
   idiom. The ‹ › arrow icon buttons use `periodStepperStyle` (H = pale lavender tint circle;
   非-H = `bgSub` fallback). Centered label in Pretendard 600–700 (§4).

**Behavior contract** (shared component, built Stage 3). Props: `unit('주'|'월'|'년')`, `offset`
(0 = current period), `onOffsetChange`, `weekStartsOn(0|1)`, `firstRecordDate`.
- **Future-blocked (built in):** `offset >= 0` → next (›) disabled; can never step past today's period.
- **First-record clamp:** stepping before the period containing `firstRecordDate` → prev (‹) disabled.
- **Unit switch resets `offset = 0`** (jump back to the current period).
- **Labels:** 주 = `"이번 주 M.DD–M.DD"` / 월 = `"YYYY년 M월"` / 년 = `"YYYY"`.
- **Week boundary = `appSettings.weekStartsOn`** (default 월요일), passed as `weekStartsOn`; pass
  `1` to force Monday. Unifies the two current call sites (수면 hardcodes Monday, 컨디션 reads the
  setting) onto one rule (결정2).

**Scope:** Theme H, tokens only; 비-H themes render the fallbacks above, unchanged behavior.
**haonStyles helper (register before build; definition only — no consumers yet):**
`periodStepperStyle(t, disabled)` (‹ › arrow button surface). Segment reuse = `<SegmentedControl>`;
no new helper. Consumers wired Stage 3 (몸무게 롤링 → 교체, 수면 인라인 스테퍼 → 수렴).

---

## 6. 캘린더 페이지 (page-specific patterns)

The **라이프 캘린더** (`/calendar`) shows life entries — 할일 / 일정 / 습관 / 자기관리 — on
the Theme H pastel canvas. It never renders money, amounts, or currency (the 머니 캘린더 is a
separate page, out of scope here). Surfaces follow §1 (solid in-flow cards, glass on overlays
only); category color is the main functional color on this page (§3, 카테고리 색).

Only the calendar-specific patterns are detailed below; shared rules are cross-referenced, not
repeated.

### 6.1 View toggle (월별 / 주별)
Uses the app-wide **Segmented control** (§5) — active = opaque white pill + soft shadow +
deep-indigo 600 label + 3px coral underline; inactive = transparent + muted label; track =
near-neutral low-saturation (NOT warm beige, NOT strong lilac). Replaces the old warm-beige/cream
toggle. No calendar-specific deviation from §5.

### 6.2 Month header
`‹  [YYYY년 M월]  ›` — centered or left, secondary controls on the right. Label in
Pretendard 600–700 (§4).

### 6.3 Category filter pills (전체 / 할일 / 일정 / 습관 / 자기관리)
A single horizontal scrollable row, no wrap. Each pill carries its category dot/outline in the
confirmed 카테고리 색 (§3). Selected = solid elevation OR a soft category-tint fill — **never a
loud gradient fill**. Unselected = hairline outline + muted label; 전체 selected = neutral solid.

### 6.4 Multi-entry day cell
Each cell stacks: date number (top) → 0–N category entry rows → a `+N개` overflow chip when
entries exceed the visible cap (3–4, tuned to cell height). Each entry row = a small
category-color dot + a truncated single-line label. This replaces the current single flat coral
bars — every entry now shows its OWN category color (§3). Always pair dot + label (never color
alone). Never render money/amounts in a cell.

### 6.5 Date markers
- **Selected day** = a soft pastel fill circle behind the date number (a pale accent tint —
  coral or lilac from the palette), number in indigo/coral on top. ⚠️ Replaces the current
  off-palette **blue** selected-date circle.
- **Today** = a quieter, distinct marker (a hairline ring, or a dot under the number).
  ⚠️ This supersedes the old §5 rule "today = filled coral circle": the filled circle is now the
  *selected* affordance, so today must be a quiet ring/dot and stay visually distinguishable
  from selected.
- **Outside-month** dates = muted (lower contrast toward the canvas).

### 6.6 Bottom detail sheet
Tap a day → a bottom sheet shows that day's entries grouped by category (할일 / 일정 / 습관 /
자기관리). Surface = overlay glass, or a solid sheet with a top drag handle, with peek/expand
states (§1 overlay glass). Rows reuse `solidRowStyle`: category-color accent + label + time;
할일 rows keep the check + KEY star affordances consistent with the todo page.

### 6.7 Bottom tab bar + center FAB
The floating bottom tab bar and any glass surfaces follow §1 / §5 (overlay glass). Only the
raised center **FAB** may use the small coral→pink gradient (a valid small-accent use, §3); its
action = add an entry for the focused day.

### 6.8 카테고리 색 (공유)
Day-cell dots, filter pills, and the home QuickCapture type chip share ONE category token set —
see §3 (카테고리 색). Do not let the calendar and the chip drift; they are the same tokens.

### Do not (calendar)
- No money / amount / currency element (this is a life calendar; the money calendar is separate).
- No glass / backdrop-filter on in-flow cells or the grid — solid white only; glass is overlay-only (§1).
- No full / large gradient fills — coral→pink is a small accent only (FAB / active underline / selected tint).
- No blue selected-date circle — use a soft pastel fill circle from the palette.
- No color-only category distinction — always pair dot + label.
- No coral as a category color (reserved for accent / FAB / selected day).
- No hardcoded color or font-family — register in DESIGN.md first (§3, §4).
- No category-color drift between the calendar and the QuickCapture chip — one shared token set.
- Any component pattern not registered here (or elsewhere in DESIGN.md) → register first, then build.

### haonStyles (구현 Stage 메모)
- **Reuse:** `canvasStyle` (page bg), `solidCardStyle` (grid container / summary / solid sheet),
  `solidRowStyle` (sheet rows), `glassBarStyle` (top bar / tab bar / glass sheet), `mixHex`
  (muted dates, selected-day tint, category dot/fill derivation), `isHaon` (Theme H gating).
- **New — register before build (not yet in code):** a day-cell layout helper (stacked entries +
  `+N개`), a date-marker helper (selected fill circle vs today ring/dot), the category dot /
  entry-row dot, and the shared 카테고리 색 tokens (same set as the QuickCapture chip). These are
  introduced in a later implementation Stage, not defined here.

---

## 7. Data visualization

Smooth spline line charts (no sharp polylines); strokes in `pink-vivid` / `lilac-purple`
/ `periwinkle`; area fill `chart-area-fill` fading to transparent; minimal gridlines;
one highlighted point with a rounded pill tooltip. Progress bars: pill, track
`rgba(46,42,91,0.10)`, fill `primary-button`.

### 아침/저녁 2-series + 갭 밴드 (dual-series comparison chart)

For paired daily readings (첫 소비처 = 아침/저녁 몸무게) rendered as **겹쳐보기(overlay) by default**:
- **Two spline lines, one chart.** 아침 = warm token (`warning` #F6C177, 앰버=아침 해); 저녁 = cool
  token (`info` #9BB4F4, periwinkle=저녁). Tokens only — never hardcode hex at the call site.
- **Gap band** — a faint fill **between the two lines** for each day both readings exist (아침↔저녁
  차이). Low-opacity neutral tint (`accentSoft` / lilac derived), well under the line strokes so it
  reads as context, not a third series. Rendered only where both points exist (no band across gaps).
- **Gap stats** (text, not a series): "오늘 갭 N kg" (그날 아침−저녁) + "기간 평균 갭" = the mean of
  **per-day gaps** (average of daily 아침−저녁, NOT 평균아침 − 평균저녁). Sign/units follow the reading.
- **`기타` slot** = a faint neutral dot only (`textMuted`, low opacity); **excluded from lines and
  from gap math**. (Flip point: to promote 기타 to a 3rd series, change only this rule + 결정1.)
- **Isolation toggles (보조):** 아침만 / 저녁만 hide the other line + the band; overlay is the default.

**Per-unit render rules** (driven by the Period navigator, §5):
- **주 / 월** — daily 아침·저녁 points + per-day gap band; stat = 기간 평균 갭 (평균 of daily gaps).
- **년** — one point per month = that month's **아침/저녁 평균** line; the 월평균 갭 for a month = the
  mean of **that month's daily gaps** (again NOT 월평균아침 − 월평균저녁).

Charts read tokens directly (as the base §7 rules do) — no haonStyles helper. Scope: Theme H, tokens
only; 비-H unaffected. First consumer wired Stage 4.

---

## 8. Responsive / platform-adaptive

Both platforms must stay individually optimized. Use Tailwind `lg:` for desktop-only.

**Mobile (<768px)** — single column, full-width cards. Bottom tab navigation. The Daily
page uses an "오늘 / 타임블록" 2-tab split. Touch targets ≥ 44px. Record cards in a 2-column grid.

**Desktop (lg ≥1024px)** — left sidebar + two-column main (content | timeline). On wide
screens the 대시보드 right rail becomes a third column. Preserve the existing PC structure;
apply the same tokens to both breakpoints.

**What shifts between them:** navigation (bottom bar ↔ side rail); timeline (stacked tab
on mobile ↔ side panel on desktop). Card/token styling stays identical across breakpoints;
only layout and navigation adapt.

---

## 9. Do / Don't

**Do**
- Make content cards solid opaque white, lifted by a soft colored shadow + hairline border.
- Reserve glass (transparency + blur) for overlays only.
- Keep the canvas quiet (near-white + soft blobs); put pastel in accents, charts, and blobs.
- Reserve strong color for one focal element per screen.
- Fill tag chips with saturated pastel; add a left accent bar to tagged rows.
- Keep every weight/role mapping consistent via Pretendard.

**Don't**
- Don't put `backdrop-filter` on content cards (invisible on a light canvas, hurts perf).
- Don't use a linear 3-stop rainbow gradient background.
- Don't use pure black text or hard gray shadows.
- Don't wash tag chips out to near-invisible low opacity.
- Don't use the diary handwriting font anywhere except diary body text.
- In theme H, `fontDecorative`/`fontDecoratePen` fall back to Pretendard (no handwriting identity in H); handwriting fonts (Gaegu/Nanum Pen) belong to themes A/B/C/D only.
- Don't change the default theme to pastel until every page is migrated (see §10).

---

## 10. Implementation & migration notes

- Implement tokens in Tailwind v4 `@theme` + `:root` CSS variables (this project has no `tailwind.config`). Components reference token names, not raw hex.
- Pastel-glass is theme `H` (`tokenH`), layered onto the existing `ThemeContext`. The warm theme (`B`) stays the default and fully preserved; pastel is opt-in during migration.
- **CLAUDE.md relationship:** CLAUDE.md governs agent behavior; this file governs visual decisions. During redesign, defer to this DESIGN.md over any "preserve existing colors/layout" rule. Keep "no hardcoded colors, tokens only."
- **Migration order:** Daily (일간) is the reference page. Bring other pages into alignment one at a time behind STOP gates. Switch the default theme to pastel only after all pages are migrated.
