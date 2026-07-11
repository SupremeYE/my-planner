---
# ─────────────────────────────────────────────
#  HAON DESIGN SYSTEM  (machine-readable tokens)
#  style: Soft Pastel Glassmorphism
#  version: 1.0
# ─────────────────────────────────────────────
name: Haon Design System
version: "1.0"
style: Soft Pastel Glassmorphism
mood: [soft, airy, pastel, glassmorphic, rounded, friendly, premium, calm, dreamy]

colors:
  # Core pastel palette (exact hex — the identity of the system)
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
  indigo-button: "#39336B"

  # Text (never pure black)
  text-primary: "#2E2A5B"
  text-secondary: "#6E6A93"
  text-muted: "#A5A2BE"
  text-on-dark: "#FFFFFF"

  # Semantic
  success: "#7FCB8F"
  warning: "#F6C177"
  info: "#9BB4F4"
  danger: "#F58A8A"

  # Surfaces
  card-frosted: "rgba(255, 255, 255, 0.55)"
  card-solid: "#FFFFFF"
  input-bg: "rgba(255, 255, 255, 0.55)"

gradients:
  app-background: "linear-gradient(135deg, #E4D7F5 0%, #F6DCE6 50%, #FCE6D8 100%)"
  app-background-alt: "linear-gradient(160deg, #C8A8E9 0%, #F6BCBA 55%, #FBE4D8 100%)"
  primary-button: "linear-gradient(135deg, #FF9A8B 0%, #FF6F91 100%)"
  card-accent-warm: "linear-gradient(135deg, #F6BCBA 0%, #E3AADD 100%)"
  card-accent-cool: "linear-gradient(135deg, #C8A8E9 0%, #C3C7F4 100%)"
  chart-area-fill: "linear-gradient(180deg, rgba(255,111,145,0.30) 0%, rgba(255,111,145,0) 100%)"

typography:
  # Primary family — full Latin + Hangul coverage, unifies the whole app
  primary: "Pretendard, -apple-system, 'Segoe UI', Roboto, sans-serif"
  # Numeric emphasis (optional) — balances, stats
  numeric: "Sora, Pretendard, sans-serif"
  # Diary body ONLY — handwriting character (self-hosted, see Font Loading)
  diary: "'Ownglyph-Positive', 'Pretendard', sans-serif"

  weights: { regular: 400, medium: 500, semibold: 600, bold: 700 }

  roles:
    page-title:     { family: primary, weight: 700, size: "26-30px", tracking: "-0.02em" }
    section-heading:{ family: primary, weight: 600, size: "18-22px" }
    card-title:     { family: primary, weight: 600, size: "16-18px" }
    body:           { family: primary, weight: 400, size: "14-15px", line-height: 1.5 }
    label-button:   { family: primary, weight: 500, size: "12-14px" }
    numeric-large:  { family: numeric, weight: 600, size: "22-32px" }
    diary-body:     { family: diary,   weight: 400, size: "15-17px", line-height: 1.8 }

radius: { sm: "10px", md: "16px", lg: "24px", xl: "32px", pill: "9999px" }

shadows:
  card-soft: "0 10px 30px rgba(120,90,160,0.14)"
  card-floating: "0 20px 50px rgba(120,90,160,0.18)"
  button-colored: "0 8px 20px rgba(255,111,145,0.35)"
  fab: "0 10px 24px rgba(46,42,91,0.30)"

effects:
  glassmorphism:
    background: "rgba(255,255,255,0.55)"
    backdrop-filter: "blur(20px) saturate(140%)"
    border: "1px solid rgba(255,255,255,0.6)"
---

# Haon Design System — DESIGN.md

This file is the **single source of truth** for every visual decision in Haon.
Before writing or changing any UI, read this file and match the tokens, type scale,
spacing, and component patterns defined here. Treat it as authoritative for all
UI/UX work. Never hardcode colors, fonts, radii, or shadows — always reference the
tokens above (implemented as Tailwind theme values and CSS variables).

Haon is a Korean personal life-planner PWA (React + Vite + TypeScript + Tailwind +
Supabase + Vercel). The visual language is **Soft Pastel Glassmorphism**: content
floats on a soft pastel gradient canvas inside frosted-glass cards, with heavily
rounded geometry and warm coral→pink accents.

---

## 1. Design principles

- Everything sits on a soft diagonal pastel gradient canvas — never a flat white or dark page.
- Cards are frosted glass: translucent white + backdrop blur + faint light border + soft colored shadow.
- Geometry is generously rounded; buttons, chips, toggles, and swatches are pill-shaped.
- Warm coral→pink gradients signal primary actions; deep-indigo solids signal strong emphasis.
- Text is deep indigo-navy, never pure black. Hierarchy comes from weight and hue.
- Icons live inside pastel tinted circular backgrounds.
- Shadows are soft, diffused, colored, and low-opacity — never harsh gray-black.
- Layout is spacious and layered: cards may overlap slightly to create gentle depth.

---

## 2. Color usage

- Primary action fill → `gradients.primary-button` (coral→pink)
- Strong action fill → `deep-indigo` solid
- Neutral action → frosted white card with `text-secondary`
- Featured/hero cards → `gradients.card-accent-warm` or `card-accent-cool`
- Body text `text-primary`, supporting `text-secondary`, hints/placeholders `text-muted`
- Never use `#000000` text, neon saturation, or flat gray shadows.

---

## 3. Typography

**Font stack**
- App-wide UI, titles, body → **Pretendard** (covers Hangul + Latin + numerals in one family; this is what unifies the app).
- Emphasis numbers (balances, stats) → **Sora** (optional; falls back to Pretendard).
- **Diary body only** → **온글잎 긍정 (Ownglyph-Positive)** — handwriting character, self-hosted. This is a deliberate exception; do not use it anywhere outside diary body text.

**Weight → role mapping** (use only these four weights; avoid 100–300 and 800–900):

| Role | Font | Weight | Size |
|---|---|---|---|
| Page title | Pretendard | 700 Bold | 26–30px |
| Section heading | Pretendard | 600 SemiBold | 18–22px |
| Card title | Pretendard | 600 SemiBold | 16–18px |
| Body / description / input | Pretendard | 400 Regular | 14–15px |
| Label / button / chip / tab | Pretendard | 500 Medium | 12–14px |
| Emphasis number (balance, stat) | Sora | 600 SemiBold | 22–32px |
| Diary body (exception) | Ownglyph-Positive | 400 | 15–17px |

---

## 4. Font loading

**Pretendard** — load via CDN (no local files needed):
```html
<link rel="stylesheet" as="style" crossorigin
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
```

**Sora** (optional) — Google Fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600&display=swap" rel="stylesheet">
```

**온글잎 긍정 (Ownglyph-Positive)** — NOT on any CDN. Self-hosted from a TTF file
provided alongside this DESIGN.md. Task for the coding agent:
1. Take the provided `.ttf` file.
2. Convert it to `.woff2` (e.g. `fonttools` + `brotli`: `pip install fonttools brotli`, then `fonttools ttLib.woff2 compress <file>.ttf`). If conversion isn't possible in the environment, stop and report it so a woff2 can be supplied manually.
3. Place the `.woff2` (keep the `.ttf` as fallback) in `public/fonts/`.
4. Register it with `@font-face`, family name **`Ownglyph-Positive`**, `font-display: swap`:
```css
@font-face {
  font-family: 'Ownglyph-Positive';
  src: url('/fonts/ownglyph-positive.woff2') format('woff2'),
       url('/fonts/ownglyph-positive.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}
```
5. Apply it **only** to diary body text. Do not touch any other page's fonts.

License note: 온글잎 긍정 is free for commercial use including web embedding (Ownglyph / VoyagerX). Font files may not be modified, redistributed, or resold — embedding for use is fine.

---

## 5. Radius, shadows, effects

- Cards: radius 24–32px. Inputs: 12–16px. Buttons: 16px or pill. Chips/toggles/swatches: pill. Icon circles: 50%.
- No rounded corners on single-sided borders; rounded corners require full borders.
- Shadows: `card-floating` for elevated cards, `button-colored` for primary buttons, `fab` for the floating action button. All soft, colored, low-opacity.
- Glassmorphism (see `effects`): apply to primary surfaces and nav; combine translucency + `backdrop-filter: blur(20px)` + faint bright border + soft shadow. Keep content-dense cards on `card-solid` if text legibility suffers.

---

## 6. Components

- **Card** — frosted (or solid for dense content), radius 24–32px, `border: 1px solid rgba(255,255,255,0.6)`, shadow `card-floating`, padding 20–24px. Cards may overlap for depth.
- **Primary button** — `gradients.primary-button`, white text, weight 600, radius 16px/pill, padding 14px 24px, shadow `button-colored`. Often full-width.
- **Strong button** — `deep-indigo` solid, white text, pill/16px. For in-card confirm actions.
- **Icon button** — circle 44–48px, pastel tinted wash background, icon in `text-primary`.
- **FAB** — circle 56px, `deep-indigo` solid, white icon, shadow `fab`.
- **Chip** — pill, padding 6px 14px, 12–13px. Active = coral gradient / solid + white text; inactive = translucent/ghost + `text-secondary`.
- **Tag** — small outlined pill, coral or indigo text, 11–12px.
- **Input** — `input-bg`, radius 12–16px, faint border, padding 14px, placeholder `text-muted`.
- **Toggle** — pill track, coral (on) / `rgba(46,42,91,0.15)` (off), white knob.
- **Segmented control** — row of circular/pill options; selected = ring/outline or filled coral. (e.g. day/week/month/year switchers.)
- **Avatar** — circle (24/32/40px), core-palette background at full saturation, white initial.
- **List row** — leading icon in tinted circle, title + subtitle stack, trailing value/action; airy vertical padding (12–16px).
- **Bottom nav** — floating rounded/frosted bar; active item tinted or filled; often paired with FAB.
- **Calendar** — 7-col grid, weekday header; today = filled coral circle; event = small colored dot; inactive days muted.
- **Stat row** — label left, bold numeric value right (numeric-large role).

---

## 7. Data visualization

- Line charts: smooth spline/monotone curves (never sharp polylines). Stroke `pink-vivid` / `lilac-purple` / `periwinkle`. Area fill `gradients.chart-area-fill` fading to transparent. Minimal gridlines. Highlight a single point with a rounded pill tooltip.
- Progress bars: pill shape, track `rgba(46,42,91,0.10)`, fill `gradients.primary-button` or a palette color.

---

## 8. Layout

- Mobile-first, single-column, vertically scrolling; the pastel gradient fills the full canvas behind all content.
- Group content into floating frosted cards separated by generous gaps (20–28px).
- Each screen: large bold page title at top, then cards, then supporting rows.
- Density is low — prioritize breathing room over information density.
- PC layout: preserve the existing two-column structure where present; apply these tokens to both breakpoints. Use Tailwind `lg:` for desktop-only adjustments.

---

## 9. Do / Don't

**Do**
- Start every screen with a soft diagonal pastel gradient background.
- Build content into frosted-glass cards.
- Use very rounded corners; pill-shape buttons, chips, toggles.
- Reserve coral→pink gradient for primary actions; deep-indigo for strong emphasis.
- Color text deep indigo-navy; scale emphasis via weight (400/500/600/700).
- Wrap icons in pastel tinted circular backgrounds.
- Keep shadows soft, diffused, colored, low-opacity.
- Draw charts as smooth curves with translucent gradient fills.

**Don't**
- No pure black text or hard black/gray shadows.
- No sharp corners, heavy solid borders, or dense compact rows.
- No dark page backgrounds or high-saturation neon.
- Don't flatten glassmorphism into opaque cards on featured surfaces.
- Don't overcrowd; preserve the airy feel.
- Don't use the diary handwriting font anywhere except diary body text.

---

## 10. Implementation notes (for the coding agent)

- Implement these tokens in `tailwind.config` (`theme.extend.colors`, `backgroundImage` for gradients, `borderRadius`, `boxShadow`, `fontFamily`) and/or as CSS custom properties, so components reference token names rather than raw hex.
- This system is a new theme layered onto the existing `ThemeContext`. Preserve the previous warm-glass look as a separate selectable theme (e.g. keep `tokenHaon` as-is); make this pastel-glass system the new default token set. Do not delete the old theme.
- **Relationship to CLAUDE.md:** CLAUDE.md governs agent *behavior* (process, guardrails); this file governs *visual decisions*. Where CLAUDE.md previously said "preserve existing colors / never change layout," defer to this DESIGN.md instead during redesign work — this file is the visual source of truth. Keep the "no hardcoded colors, tokens only" rule.
- **Migration order:** redesign the Daily (일간) page first as the reference implementation, verify at a STOP gate, then bring the remaining pages into alignment with the same patterns one at a time.
