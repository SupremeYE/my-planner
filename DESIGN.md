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

---

## 4. Typography

Fonts: **Pretendard** for all app UI/titles/body (unifies the app; full Hangul + Latin).
**Sora** optional for emphasis numbers. **온글잎 긍정 (Ownglyph-Positive)** for diary
body text ONLY (deliberate handwriting exception; never elsewhere).

Weight → role (use only these four; avoid 100–300 and 800–900):

| Role | Font | Weight | Size |
|---|---|---|---|
| Page title | Pretendard | 700 | 26–30px |
| Section heading | Pretendard | 600 | 18–22px |
| Card title | Pretendard | 600 | 16–18px |
| Body / input | Pretendard | 400 | 14–15px |
| Label / button / chip | Pretendard | 500 | 12–14px |
| Emphasis number | Sora | 600 | 22–32px |
| Diary body (exception) | Ownglyph-Positive | 400 | 15–17px |

### Font loading
- **Pretendard** — CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css`
- **Sora** — Google Fonts.
- **Ownglyph-Positive** — NOT on any CDN. Self-hosted from a provided `.ttf`: convert to `.woff2` (`fonttools` + `brotli`; if the environment can't, stop and report), place in `public/fonts/`, register `@font-face` family `Ownglyph-Positive` with `font-display: swap`, apply to diary body only. License: free for commercial/web embedding (Ownglyph/VoyagerX); do not modify or redistribute the file.

---

## 5. Components

- **Card** — `solid-card` recipe. Radius 20–24px. Record cards use the same recipe (keep the border/shadow identical whether or not a record exists; only the inner text is muted in the empty state).
- **List row** — `solid-row` recipe. Leading star/icon, title (+ optional tag chip), trailing status pill + action. Tagged rows get a 3px left accent bar in the tag hue.
- **Quick-capture box** — `solid-card` recipe, opaque white. The "+" is a coral-gradient circle. (No heavy purple fill.)
- **Primary button** — `gradients.primary-button`, white text, weight 600, radius 16px/pill, soft coral shadow.
- **Chip / tag** — pill; filled with a saturated pastel (`tags.chip-by-hue`) and a darker text sibling. Status pills (예정/완료) are small and soft.
- **Icon button** — circle 44–48px, pastel tinted background, icon in `text-primary`.
- **FAB** — circle 56px, `deep-indigo` solid, white icon.
- **Input** — `solid-card` fill, radius 12–14px, hairline border, placeholder `text-muted`.
- **Toggle** — pill track, coral (on), white knob.
- **Bottom nav (mobile)** — solid or glass floating bar; active item tinted/gradient.
- **Sidebar (desktop)** — left rail; active item = coral-gradient pill.
- **Calendar** — 7-col grid; today = filled coral circle; event = colored dot.
- **Timeline** — PLAN and DO blocks keep distinct pastel default hues (tags override); blocks get a slightly stronger border to read against the grid; the "now" line is soft coral `#FF9A8B`, not harsh red.

### Interaction states (apply to buttons, inputs, chips)
Default → Hover (slight lift: shadow +1 step, border darkens a touch) → Pressed
(scale 0.98) → Focus (coral focus ring, `0 0 0 3px rgba(255,111,145,0.25)`) →
Disabled (opacity 0.5, no shadow).

---

## 6. Data visualization

Smooth spline line charts (no sharp polylines); strokes in `pink-vivid` / `lilac-purple`
/ `periwinkle`; area fill `chart-area-fill` fading to transparent; minimal gridlines;
one highlighted point with a rounded pill tooltip. Progress bars: pill, track
`rgba(46,42,91,0.10)`, fill `primary-button`.

---

## 7. Responsive / platform-adaptive

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

## 8. Do / Don't

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
- Don't change the default theme to pastel until every page is migrated (see §9).

---

## 9. Implementation & migration notes

- Implement tokens in Tailwind v4 `@theme` + `:root` CSS variables (this project has no `tailwind.config`). Components reference token names, not raw hex.
- Pastel-glass is theme `H` (`tokenH`), layered onto the existing `ThemeContext`. The warm theme (`B`) stays the default and fully preserved; pastel is opt-in during migration.
- **CLAUDE.md relationship:** CLAUDE.md governs agent behavior; this file governs visual decisions. During redesign, defer to this DESIGN.md over any "preserve existing colors/layout" rule. Keep "no hardcoded colors, tokens only."
- **Migration order:** Daily (일간) is the reference page. Bring other pages into alignment one at a time behind STOP gates. Switch the default theme to pastel only after all pages are migrated.
