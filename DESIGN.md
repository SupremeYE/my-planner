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

### 결(seed-kind) 색 (번쩍노트 '언젠가' — 새 축)

번쩍노트('언젠가') 페이지의 **결(kind)** 은 §3 카테고리(할일/일정/습관/자기관리)와 **다른 별도의
축**이다. "문득 든 삶의 방향·바람"을 성격으로 나누는 값(미분류 / 해보고 싶은 / 되고 싶은 / 만들고
싶은)이며, 카테고리 토큰을 **재사용하지 않고 자체 named 토큰 세트로 등록**한다. 카테고리 색과
**드리프트 금지** — 같은 스와치를 공유하지 않는다(축이 다르므로 화면에 같이 뜨지 않아도 별개 토큰).
카테고리와 동일하게 각 결은 옅은 **fill**(칩 배경·행 tint)과 채도 있는 **dot / left-accent**(3px 좌측
accent·결 dot)를 가지며, 중간 톤은 `mixHex` 로 파생한다(추가 hex 손수 지정 금지).

| 결 (kind) | 의미 | dot / 3px accent | fill | text(어두운 시블링) |
|---|---|---|---|---|
| 미분류 (none, 기본) | 정제 전 씨앗 | `t.textMuted` | `mixHex(t.textMuted, 255, 0.82)` | `t.textSub` |
| 해보고 싶은 (do) | 경험 | `#D98AC9` (오키드) | `#F7E6F4` | `#A24E93` |
| 되고 싶은 (be) | 지향·가치 | `#A87BD9` (라일락) | `#EEE3FA` | `#6E4AA0` |
| 만들고 싶은 (build) | 삶의 구조 | `#6E74E0` (페리윙클-인디고) | `#E2E5FB` | `#4A56A0` |

- **none(미분류)은 고정 hex 를 만들지 않는다** — `t.textMuted`(dot/accent) + `mixHex(textMuted,255,0.82)`
  (fill) + `t.textSub`(text) 조합으로 뉴트럴하게 둔다. "아직 성격이 없는" 상태의 시각적 저강조.
- **build dot `#6E74E0` ≠ 카테고리 일정 `#7B82E3`.** 톤은 같은 인디고-페리윙클 계열이나 **동일
  스와치가 아닌 별도 토큰**으로 의도적으로 살짝 구분했다(드리프트 금지 준수). 일정 블루를 그대로
  집어오지 않는다.
- **단일 소스 맵으로 소비한다** — 카테고리 색이 컴포넌트별로 흩어져 있는 전철을 밟지 않도록, 결 색은
  `SEED_KIND_COLORS`(결→{dot, fill, text}) **한 맵**에서만 읽는다(코드 배치는 Stage 2~3, 하드코딩
  hex 를 컴포넌트에 흩지 않는다). `isHaon` 게이팅 — 비-H 는 이 페이지 자체가 H 전용이라 대상 아님.

### 라일락 fill 사용 규칙 (`lavenderTint` restraint)

라일락 tint(`t.lavenderTint` — `#F4E7FB`)는 **"선택/활성 상태"를 나타낼 때만 fill 로 쓴다.**
기본(비선택) 배경으로 쓰지 않는다. (토큰 단일화로 구 `bgSub`·`accentSoft`는 값이 같아 이 `lavenderTint`
하나로 병합됨 — 이제 이름이 라벤더임을 드러낸다. 중립 2차 표면은 `surfaceMuted`.)

- **선택 상태 = 라일락 fill 허용:** 선택된 chip(예: duration chip §5), 태그 선택(단 태그는
  카테고리 hue 우선), 그 밖에 "선택됨/활성"을 나타내는 상태. **세그먼트 컨트롤은 예외** — 흰 pill
  + 3px 코랄 언더라인이 우선이라 라일락 fill 을 쓰지 않는다(§5).
- **기본 배경 = 흰색:** 입력 필드·버튼·카드·정보 박스의 **기본(비선택)** 배경은 §5 Input/Card
  recipe(불투명 흰색 + hairline)를 쓴다. "무난한 배경색"이 필요하다는 이유로 라일락
  (`t.lavenderTint`)을 집지 않는다 — 중립이 필요하면 `t.surfaceMuted`, 흰색 + hairline, 또는 캔버스(`t.bg`).
- **경계:** hover/pressed 등 **상호작용 틴트**(`t.lavenderHover`, §5 Interaction states)는 이 규칙과
  별개(순간 피드백이지 기본 배경이 아니다). 태그·카테고리 hue(§3), 방금 등록된 특정 패턴
  (읽기전용 요약 등)의 명시 규정은 그 규정을 따른다.
- **왜:** 과거 `bgSub`(라일락 `#F4E7FB`)라는 **중립처럼 들리는 이름** 때문에 "서브 배경"으로 관성적으로
  집으면 라일락이 의미 없이 새어 나왔다. 개명(`lavenderTint`)으로 이름이 값을 드러내 이 누수를 막는다. 코랄 restraint(위)와 같은 취지 —
  강조/선택 색을 기본 표면에 흘리지 않는다. **새 토큰을 만들지 않는다(규칙만).**

#### 정적 가드 — `lint:colors` (라일락 누수 자동 차단)

이 규칙은 **사람 주의력에 의존하면 반드시 샌다**(실증: 목표 A-2 화면이 육안 "정상" 보고 뒤에도 라벤더
투성이였음). 그래서 `scripts/check-colors.mjs`(`npm run lint:colors`, pre-commit 연결 — `lint:fonts`와
동일 방식)로 정적 차단한다. **전면 금지가 아니라 "늘어남"을 막는 baseline 가드**다(라일락은 하온 정체성).

판별 규칙 (src 하위 `.ts`/`.tsx`, `ThemeContext.tsx` 제외):
- **R1 토큰 소비** — `t.lavenderTint`/`t.lavenderHover` 소비를 **파일별 baseline**(`scripts/color-baseline.json`,
  현재 총 478라인/99파일)과 대조해 **초과분만** 실패. baseline에 없는 파일에서 소비가 생기면 = 신규 소비처로 전부 잡힌다.
- **R2 라벤더 hex 하드코딩** — `#F4E7FB`·`#EFE3FA`·`#EDE4F7`·`#E8E0F6`(토큰 우회) 항상 실패.
- **R3 `purple-*`/`violet-*`/`fuchsia-*` Tailwind** — 토큰 체계 우회, 항상 실패.
- **정당한 라일락은 대상 아님** — 카테고리 색(`--cat-todo #9E6FD6` 등)은 `.css`에만 있어 스캔 밖이며 R2 밴 목록에도 없다.

조치 경로(에러 메시지가 곧 안내): 기능면 → `t.surfaceMuted`, 입력칸 → `inputBg(t)`, **정말 선택·활성·강조**면
해당 라인에 `// lint-colors-ok: <사유>` 주석(사유 필수 — 무심코 예외 처리 방지). 페이지 청소로 소비가 줄면
`npm run lint:colors -- --update`로 baseline을 조인다. 페이지별 정리 현황은 `docs/HAON_MIGRATION.md`.

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

### Surface fills — `surfaceMuted` vs `lavenderTint` (이름이 값을 드러낸다)
과거 `bgSub`(`#F4E7FB` lavender-mist)가 **중립처럼 들리는 이름으로 라일락 값**을 감춰 화면 전체가 연보라로
씻겨 보이던 문제를, **토큰 개명**으로 정리했다. 이제 이름만 보고 라벤더(`lavenderTint`)인지 중립
(`surfaceMuted`)인지 알 수 있다. 매 표면마다 **"이 색이 무언가를 의미하는가?"**를 묻는다.

| 토큰 | 의미 | 용도 | 값 |
|---|---|---|---|
| `t.surfaceMuted` | **없음** — 면 구분일 뿐 | 진행바 트랙, 세그먼트 트랙, 스켈레톤, 2차 버튼, 중립 컨테이너 배경 | 저채도 중립 그레이 `#F3F0F6` |
| `t.lavenderTint` | **있음** — "선택됨 / 활성 / 강조" | 선택된 칩, 활성 상태 배경, 의도적 라벤더 액센트 (구 `bgSub`≡`accentSoft` 병합) | `#F4E7FB` lavender-mist |
| `t.lavenderHover` | 상호작용 틴트 | hover/pressed 순간 피드백(§5 Interaction states) — 기본 배경 아님 | `#EFE3FA` |
| `inputBg(t)` | 작성 표면 | `<input type="text">` / `<textarea>` 배경 (아래 **Input** 항목) | 흰색(solid-card) |

- **판별 기준(문장):** 이 라일락이 **선택·활성·강조를 의미하면 `lavenderTint`**, 단지 카드보다
  한 단 낮은 **면 구분일 뿐이면 `surfaceMuted`**. 애매하면 임의 판단하지 말고 질의한다.

- **작성 표면 vs 선택 컨트롤 (`<select>`·피커의 갈림):** 입력칸 배경을 비우는 원칙(§5 Input)은
  "채워진 배경이 값이 든 것처럼 보여 빈 칸을 무겁게 만든다"에서 나온다. **`<select>`·피커는 항상
  값이 있으므로 이 논거가 적용되지 않는다** — "빈 상태"가 존재하지 않는다. 따라서 select/피커는
  `inputBg`로 못박지 않고 **주변 맥락을 따른다.**
  - **필터 행에 있으면 `t.surfaceMuted`** — 글을 쓰는 자리가 아니라 필터칩과 같은 무리의 선택
    컨트롤이다(예: `ReviewsView` 아카이브 필터의 연도 select). 이웃한 필터칩(surfaceMuted)과 톤을 맞춘다.
  - **폼 안에서 텍스트 입력과 나란히 있으면 `inputBg(t)`** — 입력 필드들과 한 줄로 읽히므로 작성 표면에 편입한다.
  - 이 규칙은 **맥락 의존**이라 근거("select는 빈 상태가 존재하지 않는다")를 지우면 다시 드리프트한다.
- 개명은 **순수 rename(값 불변)**이라 렌더는 픽셀 동일하다. "중립을 원하는데 라일락이 칠해진" 페이지의
  실제 중립화(→`surfaceMuted`)는 픽셀이 바뀌므로 페이지 단위로 점진 이행한다(개명과 별개 작업).

- **Card** — `solid-card` recipe. Radius 20–24px. Record cards use the same recipe (keep the border/shadow identical whether or not a record exists; only the inner text is muted in the empty state).
- **List row (행 표면 상태)** — `solid-row` recipe. Leading star/icon, title (+ optional tag chip), trailing status pill + action. Tagged rows get a 3px left accent bar in the tag hue. 행 배경은 **상태가 아니라 컨테이너 관계**로 정한다:
  - **기본 행** — 캔버스 위 독립 행 = 흰색(`solidRowStyle`); **흰 카드 안에 중첩된 행** = `t.surfaceMuted`(중립 그레이, 면 구분일 뿐). `t.lavenderTint`(라일락)를 행 기본 배경으로 집지 않는다(§3 lavenderTint restraint — 라일락은 선택·활성 전용).
  - **완료된 행** — 기본과 **동일. 배경을 바꾸지 않는다.** 완료는 체크 아이콘 + 취소선 + 텍스트 뮤트(`t.textMuted`)로만 표현한다.
  - **선택된 행** — 코랄 링(`selectedRowStyle`) 또는 코랄 3px 좌측 바. **배경 채움이 아니라 테두리/액센트로.** 선택을 의미하는 색은 코랄이어야 한다 — 라일락이 선택을 의미하면 그 자체가 드리프트.
  - **hover / pressed** — 상호작용 전용 토큰(`t.lavenderHover`, §5 Interaction states). 정지 표면 토큰(`surfaceMuted`)을 순간 피드백에 쓰지 않는다.
  - > ⚠️ **상태 변화를 배경색으로 표현하지 않는다.** 완료·진행중 같은 상태는 아이콘·텍스트 스타일·테두리로 표현한다. 배경을 상태 표현에 쓰기 시작하면 색이 화면 전체로 번진다(라일락 누수의 근원). 특히 완료 행에 배경을 채우면 완료가 미완료보다 시각적으로 **더 강해지는 역전**이 일어난다. `solidRowStyle`/`selectedRowStyle` 은 `done` 인자를 받지 않는다 — 완료 여부로 표면이 갈리지 않게 한 계약이므로 유지한다.
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
- **Input** — `<input type="text">`/`<textarea>`(작성 표면) 배경은 항상 **`inputBg(t)`**(H=solid-card
  흰색, 비-H=`t.lavenderTint`)를 쓴다. radius 12–14px, hairline border(`t.border`). **입력칸 배경은 채우지 않는다**
  — 라일락(`t.lavenderTint`/`t.lavenderTint`)으로 채우면 "이미 값이 들어있는 칸"처럼 무겁게 읽힌다.
  `<select>`·피커는 위 **"작성 표면 vs 선택 컨트롤"** 규칙을 따른다(필터 행=`surfaceMuted`, 폼=`inputBg`).
  placeholder = `t.textMuted`(보라 계열 금지). 포커스는 §5 Interaction states의 코랄 링(테두리에만
  액센트, 배경은 흰색 유지).
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
placeholder icons use **muted tokens** (`t.textMuted` on `t.lavenderTint`), not `t.accent`/coral —
they are passive nav hints, not actions (⑨b; coral stays reserved for accent / FAB / selected-day,
§3). The interactive rail toggle button keeps a subtle neutral fill (`t.lavenderTint` / `t.textSub`).

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
   idiom. The ‹ › arrow icon buttons use `periodStepperStyle` (H = **neutral `surfaceMuted` tint
   circle** — passive nav 표면이라 라일락이 아닌 중립 그레이). Centered
   label in Pretendard 600–700 (§4).

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
계열 불투명 + 하이라인 + `overflow:hidden`). 사진은 `object-cover`로 타일
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
| 선택됨 | `t.lavenderTint`(라벤더-미스트 = 라일락 tint) | `t.text`(딥 인디고) | hairline `1px solid t.border` |

- **코랄 금지.** 코랄 fill/텍스트를 쓰지 않는다 — 코랄(`t.accent`/`t.accentLight`)은 §3에서 액센트·FAB·
  선택된 날짜 전용이다. duration 선택은 카테고리성 선택이라 **라일락(`t.lavenderTint`)** 을 쓴다.
  ⚠️ `t.accentLight`은 **소프트 코랄**(`#F6BCBA`)이므로 이 용도에 쓰지 않는다 — 라일락 tint는 `t.lavenderTint`(`#F4E7FB`).
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
(`t.lavenderTint`·`t.accentLight`·`t.accent`·`t.text`·`t.textMuted`) 인라인 조합으로 커버 — 신규 헬퍼 없음.

### 날짜 입력 (Date Input — DateField)

날짜(달력일) 입력용 공통 컴포넌트. **시각 입력(TimeField)과 같은 철학**: 모바일은 OS 네이티브
피커에 위임하고, PC(`lg:`)만 커스텀 월그리드 팝오버로 그린다. 하나의 컴포넌트가 아니라 `lg:` 분기다.
`TimeField`와 자매(time-of-day ↔ calendar-day) — 저장은 `yyyy-MM-dd` 문자열.

- **왜 모바일 네이티브인가:** 아이폰 네이티브 date 피커(휠)는 사용자가 이미 100% 아는 UI이고 터치
  타겟이 OS 보장이다. 이질적으로 뜨는 "브라우저 기본 달력"은 사실상 **데스크톱 브라우저의 드롭다운
  캘린더** 문제이므로, 커스텀은 PC에만 둔다(TimeField의 "모바일은 OS 소관" 계약과 동일).
- **`duration`(기간 길이) 아님.** DateField 는 하루(달력일) 하나를 고른다. "기간(시작~종료)"은 이
  컴포넌트를 **두 개** 쓰고, 종료의 존재 여부로 단일/기간을 드러낸다(아래 "기간 확장" 참조).

```
<DateField />
  ├ 기본(모바일) → <input type="date">   (OS 위임, 커스텀 코드 없음)
  └ lg:(PC)      → 트리거 + 월그리드 팝오버 (선택=코랄, 오늘=마커)
```

**`DateField` — 모바일.** `<input type="date">` 그대로. 트리거 표면만 §5 Input(`inputBg` = solid-card
흰색 + 하이라인), 포커스는 §5 코랄 포커스 링. **네이티브 피커가 하온 톤과 다르게 뜨는 것은 정상**(OS
라이트/다크 따름 — TimeField 와 동일). 이를 이유로 커스텀 피커를 만들지 않는다.

**`DateField` — PC (`lg:`).** 트리거 버튼(선택값을 `M월 d일 (요일)`로 표시, 빈 값=placeholder) →
클릭 시 **월그리드 팝오버**:

| 항목 | 규정 |
|---|---|
| 표면 | 팝오버 = `addPopoverStyle`(§1 오버레이 글래스). 트리거 = §5 Input(`inputBg`) |
| 헤더 | `‹ YYYY년 M월 ›` 월 이동(‹ › 아이콘 버튼). 라벨 Pretendard 600 |
| 그리드 | 7열(요일 헤더 + 날짜 셀). 셀 `aspect-square`, 터치/클릭 타겟 충분 |
| 선택된 날 | **코랄** — `t.accentLight` 채움 + `t.accent` 텍스트(또는 코랄 링). §3 "선택=코랄" 준수 |
| 오늘 | 구분 마커 — `t.accent` 링/보더(선택과 겹치면 선택 우선). 채움 아님 |
| hover | `t.lavenderHover`(순간 피드백, §5 Interaction states) |
| 다른 달 날짜 | `t.textMuted` 저강조(옵션) |
| `min`/`max` | 범위 밖 날짜는 disabled(예: 종료일 필드는 시작일 이전 비활성) |
| 키보드 | Esc 닫기. (방향키 이동은 후속 — v1 클릭 위주) |

- **바로가기 유지:** "오늘" / "미지정" 같은 기존 버튼은 트리거 옆에 그대로 둔다(컴포넌트 밖 또는 prop).
- 색: **새 토큰 생성 금지** — 선택=`t.accentLight`/`t.accent`, 오늘=`t.accent`, hover=`t.lavenderHover`,
  텍스트=`t.text`/`t.textMuted` 기존 토큰 인라인 조합. `lint:colors` 통과.

**기간 확장 (단일 ↔ 여러 날) — 필드 존재로 상태 표현.** 라벨 토글("+기간으로" ↔ "단일 날짜")은
같은 자리에서 성격이 다른 두 라벨이 번갈아 나와 혼란 → **금지**. 대신:
- 기본 = 시작일 `DateField` 하나(단일 날짜). 우측에 작은 **"종료일 추가"** 아이콘 버튼.
- 누르면 아래에 종료일 `DateField` 등장(min=시작일). 종료일 필드 우측 **X** → 제거 시 단일 날짜 복귀.
- "지금 단일인가 기간인가"가 **종료일 필드의 유무**로 드러난다 — 라벨이 성격을 바꾸지 않는다.

**Scope:** Theme H, 토큰만; 非-H 는 네이티브 폴백으로 동일 구조. **haonStyles helper(기존 재사용,
신규 없음):** 트리거 = `inputBg`, 팝오버 = `addPopoverStyle`. 소비처: `TodoModal`(시작·종료) 먼저,
나머지 `<input type="date">` 17곳 이관은 후속(재사용 가능하게 설계).

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

### 번쩍노트 '언젠가' (씨앗밭 — seed / grow 패턴)

"문득 든 삶의 방향·바람"을 한 줄로 던져두는 씨앗밭 페이지 전용 컴포넌트 4종. 결(seed-kind) 색은 §3
'결 색' 표(`SEED_KIND_COLORS`)를 참조하고 여기서 색을 새로 정하지 않는다. Theme H 전용, 토큰만.
**아래 4종 모두 기존 표면 recipe 를 재사용한다 — 신규 haonStyles 헬퍼는 없다.**

**1) 던지기 입력 (throw-in).** `solidCardStyle`(불투명 흰색 + 하이라인) 한 줄 박스. 구성 = **리딩 결
칩(▾ 팝오버)** + 한 줄 인풋 + 오른쪽 **코랄 그라데이션 원형 + 버튼**(`t.primaryGradient ?? t.accent`).
- **결 칩 = §5 Quick-capture type chip idiom 재사용**(리딩 칩 + `ChevronDown` ▾). 단 타입 토글(할일↔
  일정, 2지선다)과 달리 결은 4지선다(미분류/해보고/되고/만들고)라 **탭 토글이 아니라 ▾ 팝오버**로 고른다.
  팝오버 표면 = `addPopoverStyle`(오버레이 글래스 §1). 기본값 = **미분류(none)**.
- 칩 색 = 현재 결의 `SEED_KIND_COLORS`(fill 배경 + text 텍스트 + dot). QuickAddInput 처럼 날짜/시간
  파싱은 **하지 않는다**(씨앗은 정제 전 raw 한 줄) — quickParse/QuickAddInput 컴포넌트를 재사용하지 않고
  시각 idiom 만 따른다.

**2) 씨앗 행 (seed row).** `solidRowStyle` 재사용 + **3px 좌측 결 accent**(결 dot 색) + **선두 결 dot** +
텍스트 + **하단 결 태그**(결 fill 칩 + text) + 날짜(`fontNumeric` = Sora) + **우측 상태**: 씨앗이면
"키우기" 액션(ghost/secondary §5), 자람이면 "자람" 뱃지(status pill §5, 저강조). 3px accent·dot 은
카테고리 행 accent(§5 List row, `row-left-accent`)와 동일 방식 — SEED_KIND_COLORS + inline(신규 헬퍼 없음).

**3) 결 필터 칩 (kind filter).** 가로 스크롤 한 줄(no wrap), **§6.3 캘린더 필터 칩 idiom 그대로 재사용**.
값 = 전체 / 해보고 싶은 / 되고 싶은 / 만들고 싶은. 각 칩은 결 dot/outline(SEED_KIND_COLORS). 선택 =
solid elevation 또는 결-tint fill(풀 그라데이션 금지), 비선택 = 하이라인 outline + muted 라벨, 전체
선택 = 뉴트럴 solid. (미분류 씨앗은 '전체'에서만 보이거나 별도 취급 — 필터 값에 미분류 칩은 두지 않는다.)

**4) 승격(키우기) 시트 (grow chooser).** 씨앗 "키우기" → **목표로 / 버킷으로** 택1. §5 Context add-action
의 chooser 표면 recipe 재사용: **모바일 = 바텀시트**(`bottomSheetStyle` + `sheetBackdropStyle`, 상단 드래그
핸들 + 딤), **lg: = 팝오버**(`addPopoverStyle`, 앵커 아래). '목표로' = annual_goals insert(승격, §데이터
계약) + '자람' 마킹. '버킷으로' = `grown_to='bucket'` 마킹만 + 시트에 **'곧' 힌트**(전용 뷰는 후속 라운드).
- **중복 승격 가드:** 승격 액션은 `status==='seed'` 일 때만 실행한다(이미 자람이면 시트를 열지 않는다).

**5) 자람 뱃지 메뉴 · 되돌리기 (grown badge menu).** 자람 뱃지 클릭 → 작은 메뉴(`addPopoverStyle` 오버레이):
**[목표에서 보기]**(`grown_to='goal'` 일 때만 — 목표 페이지로 이동) / **[되돌리기]**. 되돌리기는
`someday_seeds` 만 씨앗으로 복귀(`status='seed'`, `grown_to=null`, `grown_ref_id=null`) — **이미 만든
annual_goal 은 절대 삭제하지 않는다**(목표 페이지에서 수정됐을 수 있음). 되돌리기는 **`ConfirmModal` 경유**
(파괴적 아님 → 코랄/기본 버튼)로 "만들어둔 목표는 목표 페이지에 그대로 남아요" 안내 후 확정.

**6) 승격 피드백 토스트.** 승격 완료 시 앱 공용 **로컬 토스트 pill**(`t.text` 배경 + `t.bg`/`t.card` 텍스트,
BeautyCare 등과 동일 관용구 — 신규 컴포넌트 없음, 토큰만) 노출: "🌿 올해 목표로 키웠어요"(목표) /
"버킷에 담아뒀어요"(버킷). **목표 페이지로 자동 이동 금지**(맥락 유지) — 목표 토스트에는 '목표 보기' 링크만
곁들인다(탭 시 이동). 자동 dismiss(수 초).

**add-action(§5 Context add-action 매핑).** 페이지 주 엔티티 = 씨앗 → shape = **던지기입력(throw-in)**
계열이나 씨앗 전용 입력을 focus 한다(quickParse 미사용). 모바일 = **FAB 46px 솔리드 코랄**(§5 FAB,
`useFabAction({kind:'action'})`), lg: = 헤더 **"+ 추가"**(던지기 입력 shape로 스크롤/포커스, §5). 이
페이지의 shape 를 §5 "Page → shape mapping" 에 `someday = 던지기입력(씨앗 전용)` 으로 등록한다.

- **Scope:** Theme H 전용(페이지 자체가 H 게이팅), 토큰만. **재사용 헬퍼:** `solidCardStyle`(던지기
  박스·헤더 카드), `solidRowStyle`(씨앗 행), `glassBarStyle`(헤더 바), `bottomSheetStyle`/
  `sheetBackdropStyle`(승격 시트 모바일), `addPopoverStyle`(결 칩 ▾ 팝오버·승격 팝오버 lg:), `buttonStyle`
  (키우기/추가 버튼), `mixHex`(결 none fill·tint 파생). **신규 haonStyles 헬퍼 없음** — 결 색 맵
  `SEED_KIND_COLORS`(§3) + inline 조합. 결 accent/dot/태그는 카테고리 accent(§5 List row)와 동일 방식.

### 목표 페이지 — 기간별(월간 중심) 재구성 (Stage A / Stage B 상속)

목표 페이지 "기간별" 탭. **연간→월간→주간 캐스케이드 강제를 폐기하고 월간 목표를 화면 주인공으로**
둔다(구 3컬럼 동등 배치 폐기). 여기서 확정한 카드/진행/색 사용을 **다음 Stage(만다라트)가 그대로
물려받는다** — 같은 페이지 두 탭이 따로 놀지 않게 하기 위한 계약이다. Theme H 기준, 토큰만.

**레이아웃(동일 컴포넌트 `lg:` 분기).**
- **PC(`lg:`) = 2컬럼 master-detail** — 좌 340px 이번 달 월간 목표 리스트(카드 클릭 = 선택, 코랄 아웃라인
  `selectedRowStyle`), 우 나머지 = 선택된 월간의 상세(주차별 주간 목표 + 각 주간 아래 연결 할일 펼침 +
  월말 회고 슬롯).
- **모바일 = 세로 아코디언** — 연간 배너 → 기간 네비 → 월간 목표 카드(탭하면 펼침: 주간 목표 + 할일 수 +
  회고 슬롯). **고정 높이·flex 잠금 금지**(캘린더 모바일 상세패널 높이예산 붕괴 회피).

**연간 배너(얇게, 상단).** `solidCardStyle` 한 줄 배너 — "YYYY년에 되고 싶은 나" 한 줄(인라인 편집) +
핵심 가치 칩 최대 3개(정보성 칩 = 중립 `surfaceMuted`, 선택/활성 아님). **비어 있어도 화면을 막지 않는다**(저강조
placeholder, 차단 문구 없음). 연간 데이터는 `user_settings.annual_profiles`(연도별) 재사용.

**기간 네비.** `‹ YYYY년 M월 ›` — **Period navigator(§5)** idiom 재사용: 스테퍼 = `periodStepperStyle`,
중앙 라벨 Pretendard 600–700(§4). 월 단위 이동.

**월간 목표 카드.** `solidCardStyle`. 구성 = 제목(card-title §4) / **진행바** / 주간 목표 중첩 / 회고 슬롯.
- **진행바 = 얇은 바(새 패턴 금지)** — 트랙 `t.surfaceMuted`, 채움 `t.success`, 높이 6px pill. 라벨은
  `done/total · pct%`(`fontNumeric`). 기존 기간 캐스케이드 롤업(`periodProgress.ts`)을 그대로 소비.
- **선택 상태(PC)** = `selectedRowStyle`(코랄 링). 코랄은 선택·중심 전용(§3) — 목표별 색 구분이 필요하면
  6색 파스텔(lilac/blue/sage/magenta/purple/teal, 코랄 제외)을 쓰되 Stage A 는 진행바+선택 링으로 충분.

**주간 목표(중첩 자식).** 월간 카드 안에서 바로 추가·표시. 각 주간 목표에 **연결된 할일 수**(`todos.weekly_goal_id`)
를 `done/total`(예: `3/5`)로 표기. 할일 목록 펼침·연결은 기존 `WeeklyTodosInline` 재사용. **주차 라벨** =
`M월 N주차`(그 달이 걸치는 ISO 주 순번). 이번 Stage 는 **표시**가 주목적(할일↔주간 연결 UI 는 할일 페이지 별도 Stage).
중첩된 할일 행은 **§5 List row(행 표면 상태) 규칙**을 따른다 — 흰 카드 안 중첩이므로 `t.surfaceMuted`,
완료 행이어도 배경 불변(라일락 `t.lavenderTint` 금지).

**월말 회고 슬롯(목표 카드 안).** 별도 회고 화면을 만들지 않는다 — 회고 대상(목표)을 보면서 쓴다. **버튼이
백지보다 먼저**: 3버튼(달성/부분/미달, `retroStatusStyle`) + 한 줄 회고 입력(`inputBg`). `retro_status`/
`retro_note`(monthly_goals)에 저장. 상태 색은 아래 회고 슬롯 규정.

**빈 상태(기본 화면).** 목표 0행이 기본이므로 빈 상태가 성패를 가른다. **차단 문구 금지**("연간 먼저
추가하세요" 류 전부 제거). 월간 목표 없으면 → 바로 추가할 입력 어피던스를 눈에 띄게 + "연간 목표 없이도
바로 추가할 수 있어요" 안내. 주간 목표 없으면 → 월간 카드 안에서 바로 추가.

**회고 슬롯 상태 색(달성/부분/미달).** 시맨틱 색을 tint 로만 쓰고 라벨은 딥 인디고(`t.text`)로 대비 확보
(§5 duration chip 의 "붉은 위 붉은 회피"와 동일 정신). `retroStatusStyle(t, status, selected)` 헬퍼로 소비:
- 달성(done) → `t.success`, 부분(partial) → `t.warning`, 미달(missed) → `t.danger`(§3: danger=위험·삭제·**실패**,
  "미달"=실패로 정렬 — `warning`/`short` 와 혼동 금지).
- 비선택 = 흰색(`t.card`) + hairline(`t.border`) + muted 라벨. 선택 = 시맨틱 tint(`mixHex(base,255,0.82)` 파생)
  + 1.5px 시맨틱 테두리 + 딥 인디고 라벨. **신규 색 토큰 없음**(Light tint 는 mixHex 파생).

**Scope:** Theme H, 토큰만; 비-H(A/B/C/D)는 동일 구조에 각 테마 토큰으로 렌더(회귀 0). **PC 레이아웃도 이번에
함께 만든다**(구 3컬럼이 개편 대상 그 자체 — "PC 보존" 원칙의 명시적 예외). **재사용 헬퍼:** `solidCardStyle`,
`selectedRowStyle`, `periodStepperStyle`, `inputBg`, `buttonStyle`, `mixHex`, `isHaon`. **신규 haonStyles 헬퍼:**
`retroStatusStyle`/`retroStatusColor`(회고 3버튼)뿐.

### 목표 페이지 — 만다라트 탭 (Stage B, 위 계약 상속)

같은 목표 페이지의 만다라트 탭. **명암 역전이 핵심**: 예전엔 빈 셀이 라벤더로 꽉 차 "안 채운 곳"이
먼저 보였다. **빈 셀은 배경으로 물러나고, 채운 셀만 떠오르게** 한다. 위 「기간별」 계약(카드/진행/색)을 상속.

**셀 상태별 표면.**
| 상태 | 표면 |
|---|---|
| 빈 셀(ghost) | **투명 배경 + 중립 점선(`t.border`)** + 뮤트 `+`(`t.textMuted`). hover 시에만 살짝 드러남(`.mandalart-ghost`, 중립 틴트) |
| 채운 서브목표 | 흰 솔리드 카드 + **좌측 3px 컬러 액센트 바**(inset) + 리프트 그림자. **셀 전체를 색으로 칠하지 않는다**(81칸 색면 회피) |
| 중심 코어목표 | 코랄 그라데이션(`t.primaryGradient`) 고정 — **팔레트에서 코랄을 제외하는 이유** |
| 외곽 미러 셀 | 해당 서브목표의 색(`mid` 톤)으로 채움 — 중앙 세부가 외곽에서 반복되는 자리 표현 |
| 세부 셀 | 흰 솔리드 카드 |
| 완료 세부 셀 | **배경 불변**(리스트 행 규칙) — 체크 + 취소선 + `t.textMuted`. 완료가 미완료보다 강하면 안 됨 |

**색 팔레트(6색, 단일 소스 `mandalartColors.ts`).** `lilac`/`blue`/`sage`/`magenta`/`purple`/`teal`. **코랄 제외**
(선택·중심 전용). DB 에는 팔레트 **키**만 저장(`mandalart_cells.color`, hex 아님 — 토큰 바뀌어도 DB 무변경).
각 색은 채도 `bar`(좌측 바·미러 앵커) 1개 고정 + `fill`/`mid`는 `mixHex` 파생. 색 선택 = 편집 모달 내
6스와치(선택=코랄 링). NULL=미지정(중립 `surfaceMuted`/`textMuted`).

**진행 표시.** 중앙 블록 서브목표 = **8칸 점 인디케이터**(세부 완료 수), 상단 = 전체 진행률(트랙 `surfaceMuted`,
채움 `success`). 라일락 진행 트랙 금지.

**레이아웃.** PC = 3×3 블록 그리드(블록 간격 > 셀 간격으로 계층 표현, 블록 배경 투명 — 라벤더 wash 제거).
모바일 = **2단**: ① 오버뷰(중심 카드 + 서브목표 8개 카드 리스트, 각 카드에 미니 3×3 진행 그리드 + 완료 수)
② 드릴다운(카드 탭 → 세부 3×3). **고정 높이·flex 잠금 금지.**

**Scope:** Theme H, 토큰만. **재사용 헬퍼:** `solidCardStyle`, `inputBg`, `withAlpha`, `mixHex`. **신규:**
`mandalartColors.ts`(팔레트 단일 소스), `MandalartColorPicker`(공용 6스와치). 라벤더 토큰 소비 0(`lint:colors` 통과).

---

### 포커스 타이머 — 전체화면 뷰 (모바일)

집중(포커스) 타이머의 **확대 상태**. 모바일에서 축소 카드(아래 "축소 상태")를 탭하면 캔버스를 완전히
덮는 전체화면 뷰로 열린다.

**표면 분류 — glass 아님, 불투명 캔버스.**
표면 모델(§1)은 "페이지 위에 떠 있으면 glass" 지만, glass 는 **뒤에 블러할 콘텐츠가 있을 때만** 성립한다
(§1: "Glass appears when there IS content behind it to blur"). 전체화면 타이머는 전면을 덮어 **뒤에 비칠 것이
없으므로** glass 가 부적절하다 → 배경은 콘텐츠 페이지와 동일한 **불투명 캔버스**(`t.bg`, canvasStyle 계열의
flat 처리)로 정의하고 콘텐츠 표면처럼 `backdrop-filter` 를 쓰지 않는다. (§2 의 "페이지 배경에 canvasStyle
방사형 blob 을 덧칠하지 않는다"는 회귀 방지 규정과 **상충하지 않는다** — 여기선 blob 을 다시 칠하는 게
아니라 flat `t.bg` 를 그대로 덮는 것이다.)

**구성 요소 · 토큰 매핑** (숫자 = Sora `fontNumeric`, 그 외 = Pretendard 역할 필드):

| 영역 | 요소 | 색 토큰 | 폰트 역할 |
|---|---|---|---|
| 상단 | 축소(∨) 버튼 — 좌 | `t.textMuted` (bare icon) | — |
| 상단 | 모드 라벨(포모도로/스톱워치) — 중앙, 뮤트 | `t.textMuted` | `fontLabel` (500) |
| 중앙 | 상태 라벨(진행중/일시정지) — 코랄 | `t.accent` | `fontLabel` (500) |
| 중앙 | 할일 제목 — 딥인디고 600 | `t.text` (`#2E2A5B`) | `fontBody` (600) |
| 중앙 | 원형 진행 링 (아래 "진행 링") | — | — |
| 중앙 | 남은/경과 시간 숫자 | `t.text` | `fontNumeric` (Sora) |
| 중앙 | 컨트롤 3개 (아래 "컨트롤") | — | — |
| 하단 | 보조 안내 문구 | `t.textMuted` | `fontLabel` |

- 할일 제목은 페이지 섹션 제목이 아니라 "무엇에 집중 중인가" 라벨이므로 `fontSection`(제목 계열=GmarketSans)
  이 아니라 **본문 강조(`fontBody`, weight 600)** 로 둔다(§4 "나머지는 Pretendard 역할 필드").

**진행 링.**
- **트랙**: 중립 `t.surfaceMuted`, 링 두께 **13px**, 반지름 **104**(236px 정사각 캔버스 기준).
- **진행 아크**: 코랄 **단색**(`t.accent`, 그라데이션 아님 — §5 solid baseline), `stroke-linecap: round`,
  **12시 방향 시작**(SVG 그룹 `-90deg` 회전).
- **포모도로에서만 렌더한다.** **스톱워치 모드는 링을 그리지 않고 숫자만** 표시한다 — 목표(총 시간)가
  없어 빈 링이 "0% 진행" 으로 오독되기 때문.
- 진행 트랙은 아크를 읽기 위한 눈금이므로 맥락과 무관하게 중립(`t.surfaceMuted`)을 유지한다(만다라트
  진행 트랙 규정과 동일 원칙).

**컨트롤 — 중립 2 + 주 액션 1.**
하단 컨트롤은 3-버튼이며, 색과 크기로 위계를 만든다:

| 버튼 | 역할 | 표면 | 크기 |
|---|---|---|---|
| **정지** | 타이머만 종료, 할일은 **진행중 유지** | 중립 흰 원(`t.card`), 아이콘 `t.text`(Square) | 보통 |
| **일시정지 / 재개** | **주 액션** | **코랄 그라데이션**(`t.primaryGradient ?? t.accent`), 흰 아이콘 | **가장 큼** |
| **완료** | 타이머 종료 + 할일 **완료(done)** 처리 | 중립 흰 원(`t.card`), 아이콘 `t.text`(Check) | 보통 |

- 정지·완료는 **중립 흰 원**으로 동급(둘 다 "종료"지만 할일 상태 처리만 다름), 가운데 일시정지/재개만
  **코랄 그라데이션 + 최대 크기**로 시선을 모은다.
- 코랄 그라데이션을 **주 액션 하나에만** 준 것은 §5 "gradient 는 emphasis-only, 화면당 한 강조" 규칙과
  일치한다 — 중립 버튼에 그라데이션을 흘리지 않는다.
- 정지/완료의 do_* 기록·상태 전환 로직은 store(`stopTimer`/`finishActiveTimer`) 소관(문서 범위 밖).

**축소 상태(하단 카드)와의 관계.**
- 현재 `GlobalFloatingTimer` 의 모바일 하단 카드(`bottom-[72px] left-3 right-3`, 탭바 위 고정)가 이 패턴의
  **축소 상태**다.
- 축소 카드에는 **탭하면 확대됨을 알리는 셰브론(∧) 어포던스**를 둔다(카드가 눌러 펼쳐지는 표면임을 시사).
- 확대 상태는 **하단 탭바를 포함해 화면 전체**를 덮는다. 상단 축소 버튼(∨)으로 다시 카드로 접는다.
- PC(lg) 우하단 380px 카드는 이 전체화면 패턴 대상이 아니다(모바일 전용).

**Scope:** 모바일 전용, Theme H, 기존 토큰만(신규 토큰 없음). 라벤더 소비 0(링 트랙은 중립 `surfaceMuted`).

---

### 습관 트래커 — 달성 표시

습관 트래커의 **달성 표시** 공통 패턴. 탭(이번 주 / 이번 달 / 올해)마다 보는 목적이 다르므로 같은
표를 범위만 바꿔 그리지 않는다 — 주간은 "이번 주 무엇을 빠뜨렸나", 월간·연간은 "이 습관이 붙고
있나". Theme H 기준, 토큰만(**신규 색 토큰·haonStyles 헬퍼 없음** — 아래 모두 기존 토큰/헬퍼 재사용).

#### 달성 셀 색 규칙 (공통 · 최우선)

습관 하루는 **달성/미달성 이진값**이라 진하기(농담)가 표현할 정보가 없다 → **달성 셀은 단일 톤
하나만** 쓰고 채도 단계를 두지 않는다. (GitHub 잔디식 다단계 채도는 하루 다중 기록이 있을 때만
성립하며 여기선 해당 없음.) 세 상태만 정의하고, **형태·크기로 구분**되게 하여 범례(legend)를 두지
않는다:

| 상태 | 표면 | 형태 |
|---|---|---|
| **달성** | 코랄 단일 톤(`t.accent` 계열) 채움, **테두리 없음** | 꽉 찬 셀 |
| **미달성** | 흰/저채도 빈 칸(`t.card`) + **헤어라인만**(`t.border`) | 빈 셀(면 유지) |
| **해당없음** (미래·비해당 요일) | 뮤트(`t.textMuted` / `t.surfaceMuted`) | **크기를 줄인 점** — 면을 채우지 않음 |

- **코랄 = 달성은 카테고리색이 아니라 "선택·강조" 축이다.** 습관 트래커는 단일 카테고리 화면(전부
  습관)이라 §3 카테고리 구분(습관 = 마젠타)이 **적용되지 않는다** — 달성 셀은 "그날 채웠다"는
  선택·강조 상태이므로 §3이 코랄에 허용한 **"selected-day tint / emphasis"** 용법을 따른다(코랄을
  카테고리색으로 쓰는 것이 아니다). 따라서 §3 "코랄은 카테고리색으로 쓰지 않는다"와 **상충하지 않는다**.
- **셀 안에 습관 이모지를 반복 렌더하지 않는다.** 이모지는 행/카드의 **습관 이름 옆에 한 번만** 표시한다.

#### A안 — 주간 리스트 (탭: 이번 주)

한 행 = 습관 하나. `solidRowStyle`(§5 List row) 재사용. 좌→우 배치:
**아이콘 → 습관 이름 → 주기 라벨(뮤트) → 달성 합계 → 스트릭(있을 때만) → 7일 셀.**

- **위계 = 습관 이름이 행에서 가장 큰 활자.** 현재는 이름이 가장 작아 위계가 역전돼 있다(수정 대상).
  이름 = `fontBody` 강조(card-title 급), 주기 라벨 = `fontLabel` + `t.textMuted`, 달성 합계 =
  `fontNumeric`(Sora, §4).
- **7일 셀** = 균등 간격, **요일 헤더는 상단 1회.** 오늘 요일만 코랄(`t.accent`)로 강조한다.
- **해당없음 요일**(그 습관의 비해당 요일)은 같은 자리에 **작은 점**으로 축소 표시 — 달성 셀보다 작게,
  면을 채우지 않는다(위 「달성 셀 색 규칙」 해당없음 상태).
- **데스크톱/모바일 분기(Tailwind `lg:`만):** PC = 이름 줄 + 셀 줄을 **1행 유지**, 모바일 = **2행으로
  접음**(이름 줄 / 셀 줄). 분기는 `lg:` 브레이크포인트로만 — PC 레이아웃 보존.

#### B안 — 습관 카드 (탭: 이번 달 / 올해)

카드 하나 = 습관 하나. `solidCardStyle`(§5 Card) 사용. 카드 내부 순서:
**아이콘+이름 → 주기·기간 라벨(뮤트) → 미니 히트맵 → 하단 좌측 스트릭 / 하단 우측 달성 합계.**

- **미니 히트맵** = 정사각 셀 그리드, **셀 간격 < 셀 크기**(붙어 보이게). 달성 셀 색은 위 「달성 셀 색
  규칙」(코랄 단일 톤)을 그대로 쓴다. 범위:
  - **월간** — 그 달 일수만큼 칸.
  - **연간** — 12개월 × 각 월 일수만큼 칸을 늘린다.
- **연간 뷰에서 퍼센트 숫자를 나열하지 않는다** — 히트맵으로 대체한다(현재 연간 탭은 0% 셀이
  대부분이라 정보 밀도가 낮음).
- **카드 그리드:** PC = `auto-fit` 다열, 모바일 = 1열(Tailwind `lg:`만; PC 레이아웃 보존).

#### 탭별 뷰 배정

| 탭 | 뷰 | 보는 목적 |
|---|---|---|
| 이번 주 | **A안** 주간 리스트 | "이번 주 무엇을 빠뜨렸나" |
| 이번 달 | **B안** 습관 카드(월간 히트맵) | "이 습관이 붙고 있나" |
| 올해 | **B안** 습관 카드(연간 히트맵) | "이 습관이 붙고 있나" |

세 탭이 같은 표를 범위만 바꿔 그리지 않는다 — 주간과 월간·연간은 목적이 다르다. **탭 컨트롤 자체는
§5 세그먼트 컨트롤**(흰 pill + 3px 코랄 언더라인)을 그대로 쓴다(뷰 배정과 별개 — 탭 외형은 §5 준수).

#### 스트릭 배지

표시 위치·톤만 정의한다(**연속일 계산 방식은 이 문서 범위 아님**).
- **톤** = 코랄 텍스트(`t.accent`), **배경 채움 없음**(강조 과부하 방지 — 달성 셀 코랄과 텍스트/면으로 구분).
- **위치** = A안 = 달성 합계 앞(있을 때만), B안 = 카드 하단 좌측.
- **값이 0이면 배지를 렌더하지 않는다.** "0일 연속"은 표시하지 않는다.

**Scope:** Theme H, 토큰만; 非-H 는 동일 구조에 각 테마 토큰으로 렌더(렌더 계약은 H 전용).
**재사용:** `solidRowStyle`(A안 행), `solidCardStyle`(B안 카드), `<SegmentedControl>`(§5, 탭 컨트롤),
`t.accent`(달성·오늘·스트릭), `t.card`/`t.border`(미달성 빈 칸), `t.textMuted`/`t.surfaceMuted`
(해당없음 점·주기 라벨), `fontNumeric`(달성 합계·날짜), `mixHex`(필요 시 뮤트 톤 파생). **신규
haonStyles 헬퍼·색 토큰 없음.**

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
  차이). Low-opacity neutral tint (`lavenderTint` / lilac derived), well under the line strokes so it
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
