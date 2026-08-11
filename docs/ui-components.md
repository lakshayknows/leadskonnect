# ui-components.md — Supplied Frontend Assets Inventory

**Last updated:** 2026-07-03
**Status:** draft — assets documented; implementation deferred to Phase 8.

> Four ready-made design assets were supplied with exact code/specs. They are the
> canonical references for the marketing/landing surface and must be implemented
> **verbatim** to their specs, reconciled with [design_constraints.md](../design_constraints.md).
> Target location: `components/marketing/`.

---

## 1. 3D Cylinder Card Carousel

**Purpose:** hero showpiece — a continuous horizontal cylinder carousel of premium
animated bank cards. No text layers over it.

**Tech:** React (`useState/useEffect/useRef`), **Tailwind v4**, standard
`requestAnimationFrame` (60fps) — **no animation library**.

**Key behaviors (from spec):**
- Continuous `progress` variable; circular wrapping; smoothstep interpolation pushes
  cards to the sides; perspective formulas hide off-screen cards.
- Mouse `mousemove` parallax tilt with **inertia damping** (lerp factor `0.08`),
  `maxTiltY 15°`, `maxTiltX 12°`, scaled by center proximity.
- Volumetric thickness via 5 stacked layers at `z = [-1.47, -0.73, 0, 0.73, 1.47]`.
- Front face: autoplaying **video** bg, silver metallic **chip SVG**, **JWT wordmark**
  SVG (top-right), intersecting circles (bottom-right).
- Back face: blurred (16px) same video, dark magnetic stripe, cardholder **name /
  number / CVV** in **JetBrains Mono**.
- Stage bg **`#000000`**; card base **`#0f0f0f`**; wrapper `perspective: 1350px` +
  `transformStyle: preserve-3d`.
- `cardCount = 5`; card ratio 1.5925 (credit-card); responsive sizing + font metrics.

**Colors (per-card tracking):** `#FF3B30 #FF9500 #FFCC00 #34C759 #007AFF #5856D6
#FF2D55 #AF52DE #00C7BE` (Apple palette).

**Card video URLs:**
```
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_030111_a9e15665-d379-4a7f-8116-695bbe452ad1.mp4
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260429_171347_f640c30d-ec21-426a-98bc-77e07c2c60cb.mp4
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260503_104800_bc43ae09-f494-43e3-97d7-2f8c1692cfd7.mp4
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_115655_b4d9cd77-feed-43cd-a198-af78ebdf1f7a.mp4
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260324_024928_1efd0b0d-6c02-45a8-8847-1030900c4f63.mp4
```

**Card details (sample data):** Zachary Mercer · Sophia Martinez · Benjamin Carter ·
Emily Morrison · Jackson Reid (numbers + CVVs in the supplied `CARD_DETAILS`).

> **Note for implementation:** the pasted source truncated near the back-face block and
> a few JSX comment delimiters (`{/* … */}`) and template literals lost their backticks
> in transit. Re-verify the back-face `className`/`style` template strings and comment
> syntax against a clean copy before building.

---

## 2. "Our Comprehensive Branding Approach" section

**Purpose:** editorial branding section (portrait + testimonial + radial diagram).

**Tech:** React 18, **Framer Motion v12+**, **Tailwind CSS 3** (⚠ port to v4 —
see [design_constraints.md](../design_constraints.md) §6). Font **DM Sans** (400/500)
via Google Fonts.

**Key specs:**
- `<section>` `bg-[#0f0f0f]`, `text-white`; inner `mx-auto max-w-7xl px-6 py-24 …`.
- All reveals: easing **`[0.22, 1, 0.36, 1]`**, `useInView({ once:true, margin:"-60px" })`.
- Header: "Our Comprehensive" (`#6e6e6e`) + "Branding Approach" (white), `clamp(2rem,
  3.4vw, 2.6rem)`; small `+` button (`h-7 w-7`, border `white/20`).
- Glitch portrait: 250×310, Pexels image (below), **10 white glitch blocks** at exact
  `(x%, y%, w, h)` positions, staggered `0.05s` from `delay 0.5s`.
- Testimonial: Georgia curly-quote `"` (`#555`, 3.2rem), quote paragraph (`white/90`,
  `clamp(1.05rem,1.5vw,1.28rem)`), attribution "Alex West — Founder & Creative Director".
- Radial diagram: SVG `viewBox 0 0 100 100`, circle r=30, 3 labels/lines —
  websites `215°`, brands `335°`, ui/ux design `110°`; hover bolds label + thickens line.

**Image URL:**
```
https://images.pexels.com/photos/3778212/pexels-photo-3778212.jpeg?auto=compress&cs=tinysrgb&w=600
```

---

## 3. NEXOVA 404 page

**Purpose:** full-viewport 404 for hosting brand "NEXOVA" — bg video, nav, centered
hero, multi-column footer.

**Tech:** React + Tailwind + **Lucide React** icons. Font **Helvetica Now Var**
(via `db.onlinewebfonts.com`).

**Key specs:**
- Background `<video>` `autoPlay muted loop playsInline`, `object-cover`, behind all.
- Nav: NEXOVA leaf-quarter logo SVG + links (Domain/Servers/Cloud/Managed/Email/Privacy)
  + emerald→cyan gradient "LOG IN" (`ArrowRight`); mobile hamburger (Menu/X cross-fade).
- Mobile menu: `mobileMenuOpen` + `menuVisible` two-state, staggered links
  (`350 + i*50ms`), backdrop `bg-black/40 backdrop-blur-md`.
- Hero: two `h1` subtitles + giant **404** (`text-[80px]…lg:text-[260px] font-black`)
  with `.four-oh-four` glow; **"Return to Main Page"** `.liquid-glass` button.
- Footer: responsive grid (2→4→6 cols); SERVERS/DOMAINS/HELP US/ABOUT columns +
  newsletter + 6 social icons.
- `xs` breakpoint used → must be added to Tailwind config or replaced with `sm`.

**Background video URL:**
```
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260613_180732_a54afbf6-b30d-470e-861f-669871f09f67.mp4
```

**Custom CSS classes to port:** `.four-oh-four` (text-shadow glow), `.liquid-glass`
(glassmorphism with `::before` gradient border mask) — verbatim from spec.

---

## 4. Red `#FF0000` "S.P.D" hero section

**Purpose:** full-page solid-red mission/manifesto section blending into a bottom video.

**Tech:** React 19, TypeScript, Vite, **Tailwind v4** (`@tailwindcss/vite`),
**motion** (`motion/react`). Fonts: **Italiana**, **Manrope**, **Marck Script**
(via `@theme` tokens).

**Key specs:**
- `<section>` `bg-[#FF0000]`, centered content, `max-w-[900px]`.
- White logo SVG (80×80), uppercase mission statement, **"S.P.D"** in `font-marck`
  (Marck Script) at `text-[120px]`, two Title-Case `font-light` paragraphs.
- Bottom video with a **red gradient blend** (`from-[#FF0000] to-transparent`, 100px)
  masking the top edge. (Video element + URL were truncated in the paste — recover the
  bottom `<video>` src before building.)

**⚠ Accessibility:** white body/mission text on `#FF0000` = **≈4.0:1 → fails AA for
small text**. Per [design_constraints.md](../design_constraints.md), keep white-on-red
for **large** text only; for the 16px mission/paragraph copy either bump size/weight or
use `--brand-red-safe` `#D10000`. This is the single most important fix vs. the raw spec.

---

## Fonts referenced across assets (load map)

| Font | Loader | Used by |
|---|---|---|
| Apoc Revelations Italic | self-host woff2 (licensed) | global display headings |
| Helvetica Now Var | `db.onlinewebfonts.com` | NEXOVA 404, global body |
| DM Sans | Google Fonts | Branding section |
| JetBrains Mono | Google Fonts | Card carousel back face |
| Italiana / Manrope / Marck Script | Google Fonts (`@theme`) | Red S.P.D hero |
| Georgia / Times New Roman | system serif | testimonial quote glyph |

## Reference
Also referenced by the user: [lemlist.com](https://www.lemlist.com/) landing page
(personalization + campaign UI patterns). Full font/color rationale in
[design_constraints.md](../design_constraints.md).
