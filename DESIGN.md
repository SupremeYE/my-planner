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

Page background is the flat near-white base `#FBF8FC` (`t.bg`) — the same on every
page (일간·할일·캘린더·건강·습관&루틴·감정기록 …). Keep the canvas quiet; the pastel
identity lives in the accents and the charts, not in the background.

- **No per-page background override.** Layout(`Layout.tsx`/`LayoutC.tsx`)이 `t.bg`를 깔며,
  각 뷰는 자기 루트에 배경을 다시 칠하지 않는다(= 페이지마다 배경이 달라지지 않게). 예전엔
  일부 페이지만 `canvasStyle`(방사형 blob 캔버스)을 덧그려 건강 등에서 배경이 더 보라빛으로
  보였다 → 2026-07 전 페이지 단색 `t.bg`로 통일(회귀 방지). `canvasStyle`은 더 이상 페이지
  배경에 쓰지 않는다.
- The radial-blob canvas token below is retained for reference only (currently unused as a
  page background). If a subtle blob canvas is ever reintroduced, apply it once at the Layout
  level for ALL pages — never on individual views. Do NOT use a linear 3-stop
  purple→pink→peach sweep — that reads as an "AI-generated wallpaper."

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

### 라일락 fill 사용 규칙 (accentSoft / bgSub restraint)

라일락 tint(`t.accentSoft` — 테마 H 에서 `#F4E7FB`, `t.bgSub` 과 동일 값)는 **"선택/활성
상태"를 나타낼 때만 fill 로 쓴다.** 기본(비선택) 배경으로 쓰지 않는다.

- **선택 상태 = 라일락 fill 허용:** 선택된 chip(예: duration chip §5), 태그 선택(단 태그는
  카테고리 hue 우선), 그 밖에 "선택됨/활성"을 나타내는 상태. **세그먼트 컨트롤은 예외** — 흰 pill
  + 3px 코랄 언더라인이 우선이라 라일락 fill 을 쓰지 않는다(§5).
- **기본 배경 = 흰색:** 입력 필드·버튼·카드·정보 박스의 **기본(비선택)** 배경은 §5 Input/Card
  recipe(불투명 흰색 + hairline)를 쓴다. "무난한 배경색"이 필요하다는 이유로 라일락
  (`t.bgSub`/`t.accentSoft`)을 집지 않는다 — 중립이 필요하면 흰색 + hairline, 또는 캔버스(`t.bg`).
- **경계:** hover/pressed 등 **상호작용 틴트**(`t.bgHover`, §5 Interaction states)는 이 규칙과
  별개(순간 피드백이지 기본 배경이 아니다). 태그·카테고리 hue(§3), 방금 등록된 특정 패턴
  (읽기전용 요약 등)의 명시 규정은 그 규정을 따른다.
- **왜:** 테마 H 에서 `bgSub` 이 곧 라일락(`accentSoft` 와 같은 `#F4E7FB`)이라 "서브 배경"으로
  `t.bgSub` 을 관성적으로 집으면 라일락이 의미 없이 새어 나온다. 코랄 restraint(위)와 같은 취지 —
  강조/선택 색을 기본 표면에 흘리지 않는다. **새 토큰을 만들지 않는다(규칙만).**

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
(0 = current period), `onOffsetChange`, `weekStartsOn(0|1)`.
- **Future-blocked (built in):** `offset >= 0` → next (›) disabled; can never step past today's period.
- **Backward always allowed:** prev (‹) is never disabled — the past is freely browsable like a
  calendar (empty periods just render "기록 없음"), even with zero records. No lower clamp.
- **Unit switch resets `offset = 0`** (jump back to the current period).
- **Labels:** 주 = `"이번 주 M.DD–M.DD"` / 월 = `"YYYY년 M월"` / 년 = `"YYYY"`.
- **Week boundary = `appSettings.weekStartsOn`** (default 월요일), passed as `weekStartsOn`; pass
  `1` to force Monday. Unifies the two current call sites (수면 hardcodes Monday, 컨디션 reads the
  setting) onto one rule (결정2).

**Scope:** Theme H, tokens only; 비-H themes render the fallbacks above, unchanged behavior.
**haonStyles helper (register before build; definition only — no consumers yet):**
`periodStepperStyle(t, disabled)` (‹ › arrow button surface). Segment reuse = `<SegmentedControl>`;
no new helper. Consumers wired Stage 3 (몸무게 롤링 → 교체, 수면 인라인 스테퍼 → 수렴).

### Photo gallery (눈바디 — 몸 사진 기록 갤러리)

건강 > 몸무게(WeightTab) 안의 "눈바디" 섹션 진입점 → **전체화면 타임라인 그리드**. 민감 사진이므로
**비공개 저장·서명 URL 로만 표시**(취급 규칙은 CLAUDE.md "민감 사진 취급 규칙" 참조 — 영속 저장·외부
API·리포트 노출 금지). 아래는 **시각 패턴만** 등록(데이터/서명 발급은 Stage 2, 소비처는 Stage 3~4).

**1) 갤러리 그리드.** 최신순(날짜 desc) 정사각(1:1) 타일 그리드. 모바일 3열 / `lg:` 4–5열
(`grid-cols-3 lg:grid-cols-5`, PC 레이아웃 보존). 타일 표면 = `photoTileStyle(t)`(H = solid-card
계열 불투명 + 하이라인 + `overflow:hidden`, 非-H = `bgSub`/border 폴백). 사진은 `object-cover`로 타일
채움. **로딩/빈 상태**: 서명 URL 발급 전·실패 시 타일은 중립 표면 + `text-muted` 안내("불러오는 중"
/ "사진 없음") — 절대 broken-img 아이콘 노출 금지. 서명 URL 은 그리드 마운트 시 배치 발급(TTL 1h),
어디에도 영속 저장하지 않음(세션 넘기면 재발급).

**2) 썸네일 뱃지(날짜·체중·slot).** 타일 하단에 **불투명 pill**(`photoBadgeStyle(t)` — `t.card`
배경 + `t.text`/`t.textSub`, 사진 위 가독을 위해 스크림 없이 불투명 토큰 표면). 내용 = `M.DD` + 체중
`NN.N kg` + slot 라벨(아침/저녁/기타). **체중 해석 순서(결정적, 고정)**: `weight_record_id` →
같은 `date` 의 **아침 → 저녁 → 기타** → 없으면 **체중·slot 부분 생략**(날짜만). "임의 1건" 등 비결정
선택 금지.

**3) 비교 뷰(Δ).** 사진 2장 선택 → 나란히(모바일 세로 2단 / `lg:` 가로 2열). 각 사진에 날짜·체중·slot
표기. **Δ(변화량)**: **양쪽 사진의 체중 slot 이 같을 때만** 계산(예: 아침↔아침), `t.success`(감소)/
`t.danger`(증가) 토큰 색. slot 이 다르면(아침↔저녁 등) 하루 안 갭이 섞이므로 **Δ = "—"** 로 표기하고
색 강조 없음. 선택 타일 강조 = 기존 `selectedRowStyle(t)`(코랄 링) 재사용 — 신규 헬퍼 없음. 비교
카드 표면은 `solidCardStyle(t)` 재사용.

**Scope:** Theme H, tokens only(스크림·하드코딩 색 없음 — 뱃지는 불투명 토큰 pill); 非-H 는 폴백으로
동일 구조, 렌더 변화 0. **haonStyles helpers (register before build; 소비처 없음):**
`photoTileStyle(t)`(타일 표면), `photoBadgeStyle(t)`(불투명 뱃지 pill). 선택 링 = `selectedRowStyle`
재사용, 비교 카드 = `solidCardStyle` 재사용(신규 헬퍼 없음). 소비처는 Stage 3~4.

### 시각 입력 (Time Input — TimeField / HourField)

시각 입력용 공통 컴포넌트 패밀리. **시각 입력기를 직접 만들지 않는다** — 모바일은 OS 네이티브
피커에 위임하고, PC만 커스텀 콤보박스로 그린다. 하나의 컴포넌트가 아니라 `lg:` 분기다.
- 시각 입력은 하온의 차별점이 아니다 — 커스텀 피커는 유지보수 부채만 남긴다. 아이폰 네이티브
  피커는 사용자가 이미 100% 아는 UI다.
- 데스크톱은 키보드가 있어 타이핑이 가장 빠르고, 네이티브 데스크톱 피커는 OS 로케일에서
  오전/오후 포맷을 강제해 24시간제 앱과 충돌한다 → PC만 커스텀할 근거.

```
<TimeField />
  ├ 기본(모바일) → <input type="time">   (OS 위임, 커스텀 코드 없음)
  └ lg:(PC)      → 콤보박스              (타이핑 + 5분 목록)
```

**두 종류 — 혼동 금지.** `duration`(길이) 의미의 입력은 **0곳**이다(조사 확정). 새로 생기면 이
두 컴포넌트를 쓰지 말고 별도 패턴을 등록한다.

| | `TimeField` | `HourField` |
|---|---|---|
| 의미 | 하루 중 시각 (time-of-day) | 범위 경계, **정시 전용** |
| 저장 | `HH:mm` 문자열 | **정수 시(hour)** |
| 분 입력 | 가능 | **불가** |
| 예 | 계획 시작, 취침/기상, 알림 | 하루 시작·끝 경계 |

> 소비처 인벤토리·인스턴스 카운트·이전 순서는 `docs/STAGE4A0_TIMEPICKER_CALLSITES.md`에 둔다
> (이전이 끝나면 낡는 수치이므로 여기 계약에는 넣지 않는다). DESIGN.md는 계약만 — 위 2종 분류와
> `duration` 0곳.

**`TimeField` — 모바일.**
- `<input type="time">` 그대로 사용. 피커 UI를 직접 그리지 않는다.
- 트리거 표면만 §5 Input(`inputBg` = `solid-card` fill + 하이라인 border)을 따르고, 포커스는
  §5 Interaction states의 coral focus ring을 쓴다. 숫자는 `fontNumeric`(Sora, §4).
- **네이티브 피커가 하온 톤과 다르게 뜨는 것은 정상이다.** OS 라이트/다크를 따르며 앱 테마를
  따르지 않는다(키보드가 앱 테마를 따르지 않는 것과 같다). 이를 이유로 커스텀 피커를 만들지 않는다.

**`TimeField` — PC (`lg:`).** 콤보박스 — 드롭다운 전용이 아니라 타이핑이 1차 입력 수단이다.

| 항목 | 규정 |
|---|---|
| 클릭 시 | 텍스트 전체 선택 + 목록 열림, 현재값 위치로 스크롤 |
| 타이핑 | `9`→09:00, `930`→09:30, `1415`→14:15. 목록 실시간 필터링 |
| 목록 간격 | 5분 |
| 목록 강약 | 정시·30분은 `fontNumeric` 500 + 본문색(`t.text`), 나머지는 `t.textMuted`(스캔 장치) |
| 키보드(동작) | ↑·↓ 이동 / Enter 확정 / Esc 취소 |
| 확정 후 | 종료 필드로 포커스 자동 이동 |
| 포맷 | 24시간제 고정. 오전/오후 금지 |

종료 필드 추가 규정:
- 목록 항목에 duration을 우측 정렬로 병기: `10:30  1시간`. 사용자가 산수하지 않게 한다.
- 시작보다 이른 시각은 목록에 존재하지 않는다 — 잘못된 값을 만들 수 없게 한다.
- 시작을 바꾸면 종료가 기존 길이를 유지한 채 따라간다. 기본 길이 = 1시간.
- 빈 값: ✕ 클리어 버튼을 유지한다(빈 문자열 + Enter만으로는 발견 가능성이 낮다).

표면:
- 트리거 = §5 Input(`inputBg`). 중립 회색 fill 등 새 토큰을 도입하지 않는다 — 클릭 시 전체
  선택 하이라이트 + coral 포커스 링이 어포던스를 충족한다.
- 팝오버(목록)는 "페이지 위에 뜨는 것" → §1 오버레이 글래스(`addPopoverStyle`) 대상
  (떠 있는 드롭다운 패널이므로 상단 바 전용 `glassBarStyle`이 아니라 팝오버 recipe `addPopoverStyle`을 쓴다).

**duration chip (모바일 종료 빠른설정).** 모바일에서 종료를 `시작 + 길이`로 잡는 보조 칩
(`30분 / 1시간 / 1시간 30분 / 2시간`). PC는 종료 콤보박스 목록의 duration 병기가 대신하므로 **모바일
전용**(`lg:hidden`), 좁은 종료 칼럼이 아니라 **폼 전체 폭 한 줄**(시작 필드 위치부터)에 배치. **단일 선택
토글** — 현재 계획 길이(종료−시작)와 일치하는 칩 하나만 선택 상태.

| 상태 | 배경 | 텍스트 | 테두리 |
|---|---|---|---|
| 기본(비선택) | `t.card`(흰색) | `t.textMuted` | hairline `1px solid t.border` |
| 선택됨 | `t.accentSoft`(라벤더-미스트 = 라일락 tint) | `t.text`(딥 인디고) | hairline `1px solid t.border` |

- **코랄 금지.** 코랄 fill/텍스트를 쓰지 않는다 — 코랄(`t.accent`/`t.accentLight`)은 §3에서 액센트·FAB·
  선택된 날짜 전용이다. duration 선택은 카테고리성 선택이라 **라일락(`t.accentSoft`)** 을 쓴다.
  ⚠️ `t.accentLight`은 **소프트 코랄**(`#F6BCBA`)이므로 이 용도에 쓰지 않는다 — 라일락 tint는 `t.accentSoft`(`#F4E7FB`).
- **대비(붉은 위 붉은 회피).** 라일락 배경(밝음) + `t.text` 딥 인디고 텍스트 → §3 "순수 검정 금지·딥
  인디고" 준수하며 대비 확보.
- **선택 신호 = fill + 텍스트.** 라일락 fill + 딥 인디고 텍스트(vs 흰색 + muted)가 선택을 나타낸다.
  테두리는 두 상태 모두 중립 hairline(`t.border`) — 코랄 테두리 금지. (범용 라일락 테두리 토큰은 없고
  `t.planBorder`는 PLAN 전용이라 의미 결합 방지 위해 재사용하지 않는다.)
- pill(radius 999) 허용(§5 compact action). 타이포 = §4 chip(Pretendard 500, 12–14px).
- 현재 길이가 어느 칩과도 안 맞으면(커스텀 분·빈 값) 전부 기본 상태 — 정상.
- **세그먼트·태그 chip과 구분.** 세그먼트 컨트롤 활성 = 흰 pill + 3px 코랄 언더라인(§5), 태그 chip =
  카테고리 hue 채움(§5) — duration 선택은 **라일락 fill**(언더라인·hue 아님). 역할이 달라 공존한다.

**`HourField`.** 현재 `TimePicker`는 `minuteStep=1`로 분 입력을 받고 저장 시 분을 버린다
(`06:30` → `6`). `HourField`는 이 무음 손실을 제거한다.
- 시(hour) 선택만. 분 입력 UI를 제공하지 않는다.
- 표시: `06시` / `24시`. 하루 경계이므로 `+24` wrap을 명시 표기 → 종료가 다음날이면 `26시 (다음날 02시)`.
- 표면은 §5 Input(`inputBg`). 모바일/PC 분기 없음 — 선택지가 적어 `select` 하나로 충분하다.

**금지.**
- ▲▼ 스테퍼 금지(정밀도 불필요 + 간격 큼, 둘 다 아님).
- 분을 1분 단위로 나열한 목록 금지.
- 오전/오후 포맷 금지(PC 커스텀 한정 — 네이티브는 OS 소관).
- 시각 입력을 위한 **새 색 토큰 생성 금지** — §5 Input + 기존 accent로 충분하다.
- `minuteStep`처럼 **실제로 반영되지 않는 prop 금지** — UI가 받은 값은 반드시 저장되어야 한다.

**step 제약 메모.** 30분 스냅 같은 제약을 컴포넌트에 넣지 않는다. 조사에서 같은 수면 필드가
`CalendarView`=5분 / `SleepTimeEditModal`=30분으로 갈려 있었다 — 한 화면에서 `23:47`을 넣을 수
있으면 그 제약은 이미 존재하지 않는다. 제약이 진짜라면 데이터 계층에서 강제하고, 아니라면 UI에서
흉내 내지 않는다.

**Scope:** Theme H, 토큰만; 非-H 테마는 §5 Input/네이티브 폴백으로 동일 구조(렌더 계약은 H
전용). **haonStyles helper (기존 재사용, 신규 없음):** 트리거 표면 = `inputBg`, 팝오버 =
`addPopoverStyle`(둘 다 §1 오버레이 글래스 계약 충족 — 떠 있는 드롭다운은 상단 바 전용 `glassBarStyle`이
아니라 팝오버 recipe). 콤보박스 목록 항목 상태(hover/active·정시/30분 강약)는 기존 토큰
(`t.bgSub`·`t.accentLight`·`t.accent`·`t.text`·`t.textMuted`) 인라인 조합으로 커버 — 신규 헬퍼 없음.

### 읽기전용 값 요약 (Read-only value summary — 값이 다른 곳에서 관리되는 필드)

폼 안에서 **값은 보여주되 편집·생성 권한은 다른 표면이 갖는** 필드의 표시 패턴. 입력기를 두지 않고
읽기전용 요약으로 렌더한다. (첫 소비처: `TodoModal` 실제(DO) 시각 — 생성·조정은 타임라인/타이머가
관리, 모달은 표시만. 근거 `docs/STAGE2_0_DO_USAGE.md`.)

- **입력기 아님.** `<input>`/피커가 아니라 한 줄 텍스트로 렌더: `[라벨] 값 · 부가`. 클릭 가능한 입력처럼
  보이는 어포던스(테두리 fill·포커스 링·▲▼ 스피너)를 주지 않는다.
- **라벨 색 = 그 도메인의 기존 역할색 유지.** (실제 = `t.success` — 계획/실제 구분용, §7.2 증감 토큰과
  별개.) 값 본문은 §3 텍스트 토큰: 주값 = `t.text`(딥 인디고), 부가(소요 등) = `t.textMuted`/`t.textSub`.
- **단일 소스 표시.** 표시 값은 **하나의 소스에서만** 뽑는다 — 파생/폴백을 섞지 않는다(예: 실제는
  `do_start~do_end`만; `do_elapsed_sec`를 섞으면 표기 시각과 소요가 어긋난다). 폴백 ≠ 표시(§7.4·
  CLAUDE.md 통계 원칙과 동일 정신).
- **편집 경로 유도.** 값 아래에 어디서 편집하는지 저강조 힌트(ghost/text, §5)를 둔다("타임라인에서
  조정"). 힌트는 안내지 버튼이 아니다.
- **빈 상태 = 영역 없음.** 값이 없으면 **영역 자체를 렌더하지 않는다**(편집 진입점이 아니므로 빈
  프레임으로 유도하지 않는다 — Input/Card가 빈 상태에서도 프레임을 유지하는 것과 반대).
- **라벨 대칭(짝 이룰 때).** 편집 필드와 읽기전용 요약이 위아래 짝이면 라벨을 대칭으로 준다 — 예:
  `[계획] [시각 입력]` / `[실제] [읽기전용 요약]`. 같은 데이터의 화면명은 SSOT 를 지킨다(계획↔실제 —
  타임라인 요약 "계획 시간/실제 시간"과 일치, "실적/실행" 아님).
- **Scope:** Theme H, 토큰만; 非-H 동일 구조(텍스트+토큰이라 테마 무관). **새 토큰·새 헬퍼 없음** —
  텍스트 토큰 + §5 ghost 힌트 조합.

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
- **Reuse:** `solidCardStyle` (grid container / summary / solid sheet),
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

### 7.1 차트 팔레트 (SSOT — 모든 차트 페이지 공통)

앱의 모든 차트/그래프/히트맵/막대가 참조하는 **단일 기준 파스텔 data-viz 세트**. 건강 페이지
조사(수면·컨디션·몸무게 차트의 색 역할 R1~R8)에서 도출·확정. 아래 값은 **확정본**이며, 컴포넌트는
이 역할에 매핑해 소비한다(하드코딩 금지 — 舊 워엄 하드코딩 `#5B8ED4`/`#D4735A`/`#C4A882` 등은 폐기).

| 역할 | fill / 주색 | 텍스트·스트로크 | 용도 |
|---|---|---|---|
| **good (충족/양호)** | 세이지 `#8FCBA0` | `#3B7D54` | 수면 ≥7h, 수면부채 충족, 잘 잔 그룹, 정상 주기 |
| **short (미달/부족)** | 코랄 `#F3A88F` | `#C55C3A` | 수면 <7h, 수면부채 부족, 못 잔 그룹, 비정상 주기 |
| **trend (추이 라인·단일계열)** | 페리윙클 `#7B82E3` | `#7B82E3` | 수면 추이, 스트레스 추이, 운동 성장 |
| **reference (참조/기준선)** | 뮤트 `#B0ACC4` | `#B0ACC4` | 수면 권장선, 몸무게 목표선 |
| **empty (무기록/빈 상태)** | 뉴트럴 `#E4E1EC` | — | 기록 없는 차트 배경 셀 |

- **trend 라인**: 2px stroke, 라운드 캡, 끝점(end-dot)에 흰 링. 스플라인(부드러운 곡선).
- **reference 선**: `dashed 4 4` 점선.
- ⚠️ **short ≠ danger.** `short`(부족·주의)는 되돌릴 수 있는 경고이지 오류·삭제가 아니다.
  삭제·실패·위험은 `danger`(§3, `t.danger`)를 쓴다 — 둘을 섞지 않는다.

**sequential (강도 순차 스케일 1→5)** — 코랄 단색 램프. 컨디션 스트레스 셀·히트맵 강도에 사용.

| 1 (약) | 2 | 3 | 4 | 5 (강) |
|---|---|---|---|---|
| `#FBE7DF` | `#F6C7B4` | `#F0A98E` | `#E68A6A` | `#D96F4C` |

**categorical (3계열)** — 서로 구분되는 3색. 체성분(체중/체지방/골격근)에 사용. 카테고리 색(§3)과
hue 계열은 맞추되 **차트 전용 톤**임을 명시(§3 카테고리 토큰을 그대로 쓰는 것이 아님).

| 계열 1 | 계열 2 | 계열 3 |
|---|---|---|
| 블루 `#7B82E3` | 코랄 `#F0997B` | 세이지 `#6BAA7A` |

### 7.2 규정

- **증감 방향(증가/감소)은 §7에서 재정의하지 않는다.** 기존 시맨틱 토큰 유지 — 증가 = `danger`,
  감소 = `success` (§3 참조). 예: 몸무게 증감 라벨.
- **진행바 트랙/채움은 위 기존 규정 유지** — track `rgba(46,42,91,0.10)`, fill `primary-button`.
- **색만으로 계열을 구분하지 않는다(접근성).** 라인은 dash 패턴/마커를 병행하고, 막대·셀은 라벨을
  병행한다(색맹·저대비 환경 대비).
- **탭 아이덴티티색(수면 = 파랑, 생리 = 핑크)은 폐기.** 위 역할색(good/short/trend/sequential)으로
  통합한다 — 페이지·탭마다 다른 브랜드색을 두지 않는다.

### 7.3 아침/저녁 2-series + 갭 밴드 (dual-series comparison chart)

두 값을 하루에 함께 재는 경우(첫 소비처 = 아침/저녁 몸무게)의 특수 패턴 — §7.1 SSOT 역할이 아니라
비교 의도(아침 warm vs 저녁 cool)에 맞춰 별도 토큰을 쓴다. Rendered as **겹쳐보기(overlay) by default**:
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

### 7.4 몸무게 통계 카드 — 기준 slot 라벨 (like-for-like)

몸무게 통계 카드 3종(**현재 체중 · 7일/30일 대비 · 진행률**)은 **"기준 slot(reference slot)"** 하나로만
계산하고, 그 기준을 **UI에 항상 명시**한다. slot 폴백(아침→저녁→기타, 눈바디 뱃지용 = "가용성" 해결)을
통계에 재사용하지 않는다 — 통계는 "비교 가능한 동일 slot 쌍"(비교가능성)이 목적이라 규칙이 다르다.

- **기준 slot = 아침 고정.** 예외(전환): **최근 30일 내 아침 기록 0건이면 저녁 기준으로 전환**하고 라벨도
  '저녁 기준'으로 바꾼다. (아침이 "아예 없을 때"만 전환 — 기준이 자주 뒤집혀 숫자 의미가 흔들리는 걸 방지.)
- **탐색 단위 = "기준 slot 기록이 있는 날".** 기준일 이전 가장 가까운 *기준 slot 기록이 있는 날*과 비교한다.
  기준 slot 이 없는 날은 **건너뛰고 더 과거로** 탐색. **같은 날 다른 slot 으로 바꿔치기 금지.**
- **기타(other)는 기준 후보에서 제외**(⑩ "기타는 갭 계산에서 제외" 규칙과 정렬).
- **라벨(숨기지 않는다):**
  - **현재 체중** = 최신 기준-slot 기록 값 + `(날짜 slot)` — 예 `60.0kg (7.14 아침)`. 최신 측정값이 다른
    slot 이어도 현재 체중엔 쓰지 않는다(카드 내 숫자들의 기준 통일).
  - **N일 대비** = 값 + `(기준 slot 기준)` — 예 `7일 대비 −1.0kg (아침 기준)`. 증가=`danger`/감소=`success`(§7.2).
  - **비교 불가** = `—` + 사유(예: "아침 기록 2회 이상 필요"). **다른 slot 으로 대체 금지**(D4 눈바디 Δ와
    동일 정신: 같은 걸 재는데 규칙이 둘이면 안 됨).
- **진행률**도 동일 기준-slot 값(현재 체중)으로 계산.

Scope: Theme H, 토큰만(라벨 색은 §7.2 증감 토큰). 라벨은 텍스트라 haonStyles 헬퍼 불필요(신규 헬퍼 없음).

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
