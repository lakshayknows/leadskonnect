# design_constraints.md — LeadsKonnect Design System ("Konnect")

> Binding design constraints. Every screen must comply. This replaces the earlier
> system that was borrowed from unrelated reference brands (NEXOVA / S.P.D / bank
> cards). LeadsKonnect now has one coherent identity: **bright, human, techy-clean**.

**Last updated:** 2026-07-03
**Status:** draft

---

## 0. Thesis

LeadsKonnect orchestrates many channels into **one synced conversation, safely**. The
signature element across the product is the **connection motif** — nodes (channels)
threaded into a single lead, the literal "Konnect". Reference energy: lemlist (human,
energetic outreach tool) — but our own palette and type, never a copy.

## 1. Color

Tokens live in `app/globals.css` under `@theme`.

| Token | Hex | Use |
|---|---|---|
| `--color-canvas` | `#fbfaf7` | warm-white page background |
| `--color-surface` | `#ffffff` | cards, raised surfaces |
| `--color-ink` | `#141414` | primary text, dark panels |
| `--color-ink-soft` | `#55524d` | muted body text |
| `--color-line` | `#e7e4dd` | hairlines |
| `--color-brand` | `#2b4dff` | electric cobalt — brand, links, primary marks |
| `--color-brand-ink` | `#1a2fb8` | cobalt text on tint (contrast-safe) |
| `--color-action` | `#ff5c39` | coral — CTAs, energy accent |
| `--color-tint` | `#eef1ff` | soft-blue section surface |

**Channel colors** (encode meaning in the connection motif — not decoration):
email `#ff5c39` · linkedin `#2b4dff` · whatsapp `#12b76a` · social `#7a5af8`.

**60-30-10:** ~60% canvas/white, ~30% ink + tint, ~10% cobalt/coral accent.
**Accessibility:** ink on canvas ≈ 15:1. White on cobalt `#2b4dff` ≈ 6.3:1 (AA pass).
White on coral `#ff5c39` ≈ 3.1:1 → **large/bold text or icons only**, never small body
copy (mirrors the general "don't rely on a mid-tone behind small text" rule).

## 2. Typography

Deliberate, non-default pairing (avoids the AI-default high-contrast serif):

| Role | Face | Notes |
|---|---|---|
| Display | **Bricolage Grotesque** (`--font-display`) | headlines; tight tracking `-0.02em`, weight 700–800 |
| Body / UI | **Inter** (`--font-body`) | default; 16px base, line-height 1.5 |
| Data / utility | **JetBrains Mono** (`--font-mono`) | eyebrows, limits, metrics, captions |

Loaded via Google Fonts in `globals.css`. Display scale uses `clamp()` for fluid
headlines (e.g. hero `clamp(2.6rem, 6vw, 4.6rem)`).

- **Eyebrows** are mono, uppercase, `0.22em` tracking — they label sections.
- **Gradient text** (`.gradient-text`): cobalt→coral→cobalt, animated `background-position`
  on scroll (GSAP) for the "gradient text scroll" effect. Use on **one** word per view.

## 3. Motion

- **GSAP + ScrollTrigger** is the animation engine.
- **Hero:** page-load timeline (staggered `.lk-rise`), node pop-in (`back.out`), pulses
  traveling the connection threads (`getPointAtLength`), and gradient-position scroll.
- **ChannelCards:** the 3D card deck is **scroll-driven** — ScrollTrigger `pin` + `scrub`
  scrubs the active card; mouse adds parallax tilt. (Repurposed from the old carousel
  engine; content is now channels, movement is now scroll.)
- **Sections:** `scrollTrigger` reveals (`y:40, opacity:0`, `power3.out`, small stagger).
- Shared feel: `power3.out` / `power2.out`, once-in, subtle. **No infinite blinking.**
- **Reduced motion:** every component checks `prefers-reduced-motion` and skips
  timelines; CSS also neutralizes animation/transition durations.

## 4. Surfaces & effects

- **Glass** (`.glass` light / `.glass-dark`): blur + saturate + hairline highlight.
  Used on the nav (on scroll), hero card, and the 3D channel cards.
- **Ambient:** `.grid-dots` (subtle dotted grid), `.glow-brand` (cobalt radial at top).
- Radii on a scale: pills for buttons (`999px`), `16–32px` for cards/panels.

## 5. Buttons & interaction

- `.btn-primary` = coral pill, lifts on hover (`translateY(-2px)` + shadow).
- `.btn-ghost` = hairline border, border darkens on hover.
- Focus: visible `2px` cobalt outline (quality floor). Touch targets ≥ 44px.

## 6. Iconography

**Lucide React** throughout. The **Konnect mark** = two nodes joined by a coral thread
(cobalt filled node + white outlined node). Appears in nav, footer, and 404.

## 7. Pages

| Surface | Direction |
|---|---|
| Landing (`/`) | Nav → Hero (connection graph) → ChannelCards (scroll 3D deck) → HowItWorks (earned numbered sequence) → Safety (guardrail stats) → CTA + Footer |
| Dashboard (`/dashboard`) | Light command center; stat tiles + channel cards in brand colors |
| 404 (`not-found`) | On-brand "this lead went cold"; gradient 404; LeadsKonnect nav + footer |

## 8. 10-second review

- [ ] Focal point clear; one gradient-text word max per view.
- [ ] Only Bricolage / Inter / JetBrains, each in its role.
- [ ] 60-30-10; nothing small in white-on-coral.
- [ ] Spacing consistent; cards/pills on the radius scale.
- [ ] Hover + focus states present; reduced-motion respected.
- [ ] Connection motif reads as *the* memorable element; everything else quiet.

## Removed
The bank-card carousel, red S.P.D hero, "Alex West" branding section, and NEXOVA
identity have been **removed** — they were reference brands, not LeadsKonnect. Their
techniques (3D depth, scroll reveals, glass) live on in the components above.
