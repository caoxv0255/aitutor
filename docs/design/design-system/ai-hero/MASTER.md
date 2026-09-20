# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** 智启AI导师 Hero
**Generated:** 2026-09-16 21:48:35
**Category:** Educational App

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#4F46E5` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#818CF8` | `--color-secondary` |
| On Secondary | `#0F172A` | `--color-on-secondary` |
| Accent/CTA | `#EA580C` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#EEF2FF` | `--color-background` |
| Foreground | `#1E1B4B` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#1E1B4B` | `--color-card-foreground` |
| Muted | `#EBEEF8` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#C7D2FE` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#4F46E5` | `--color-ring` |

**Color Notes:** Playful indigo + energetic orange [Accent adjusted from #F97316]

### Typography

- **Heading Font:** Baloo 2
- **Body Font:** Comic Neue
- **Mood:** kids, education, playful, friendly, colorful, learning
- **Google Fonts:** [Baloo 2 + Comic Neue](https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700&family=Comic+Neue:wght@300;400;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700&family=Comic+Neue:wght@300;400;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #EA580C;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #4F46E5;
  border: 2px solid #4F46E5;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #EEF2FF;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #4F46E5;
  outline: none;
  box-shadow: 0 0 0 3px #4F46E520;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Claymorphism

**Keywords:** Soft 3D, chunky, playful, toy-like, bubbly, thick borders (3-4px), double shadows, rounded (16-24px)

**Best For:** Educational apps, children's apps, SaaS platforms, creative tools, fun-focused, onboarding, casual games

**Key Effects:** Inner+outer shadows (subtle, no hard lines), soft press (200ms ease-out), fluffy elements, smooth transitions

### Page Pattern

**Pattern Name:** Feature-Rich Showcase

- **Conversion Strategy:** Clear feature hierarchy. One key message per card. Strong CTA repetition.
- **CTA Placement:** Hero (sticky) + After features + Bottom
- **Section Order:** Hero (value prop) > Feature grid/cards (4-6) > Use cases or benefits > Social proof or logos > CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ ~~Dark modes~~ — **REMOVED 2026-09-17**: shipped dark mode with OLED-friendly tokens. See Dark Mode section below.
- ❌ Complex jargon

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Dark mode: text contrast 4.5:1 minimum (all critical pairs)
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## Dark Mode Tokens (shipped 2026-09-17, verified WCAG AA)

**Design Read:** Premium-consumer education hero on OLED-friendly near-black, brand red 保真, alpha-tinted backgrounds (NOT hue shift), tiered elevation, NO AI-purple.

### Surface Elevation (4-tier)

```css
@media (prefers-color-scheme: dark) {
  :root {
    /* Page → surface → card → high */
    --bg:        #0a0b10;   /* page near-black, OLED-friendly */
    --surface:   #161922;   /* elevated */
    --surface-2: #1f2330;   /* card / high-elevation */
    /* never pure #000 or #fff (taste-skill §8.B) */
  }
}
```

### Ink Scale (off-white, never pure)

```css
--ink:       #f0f2f7;  /* 17.55:1 on --bg  AAA */
--ink-2:     #b6bcca;  /* 10.33:1 on --bg  AAA */
--ink-3:     #8a90a0;  /*  6.16:1 on --bg  AAA (must be ≥ #757b8a) */
```

### Border Scale

```css
--line:      #2a2f3c;
--line-soft: #1d212c;
```

### Brand-Red Tinted Backgrounds (lifted for WCAG)

```css
--brand-red-50:  #3a1719;  /* eyebrow bg */
--brand-red-100: #4a1d20;
```

### Verified Contrast Pairs (WCAG AA + AAA target)

| Pair | Ratio | Grade |
|------|-------|-------|
| ink on bg | 17.55:1 | AAA |
| ink-2 on bg | 10.33:1 | AAA |
| ink-3 on bg | 6.16:1 | AAA |
| ink-2 on surface-2 | 8.23:1 | AAA |
| ink-3 on surface-2 | 4.90:1 | AAA |
| `#ff7a7a` (eyebrow text) on brand-red-50 | 6.32:1 | AAA |
| white on brand-red (#d71920) CTA | 5.19:1 | AA |
| white on brand-red-dark (#b8151b) CTA hover | 6.64:1 | AAA |
| white on brand-red-darker (#7f0e12) final-CTA | 10.64:1 | AAA |

### Key Patterns (recipe)

1. **Nav backdrop**: use `color-mix(in srgb, var(--bg) 78%, transparent)` — adapts per theme. NEVER hardcode `rgba(255,251,248,0.78)`.
2. **Brand-red bg on tinted bg**: text uses `#ff7a7a` or `#ff8a8a`, NOT brand-red `#d71920` (3.08:1 fails).
3. **9 学科 dots halo**: `box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px rgba(255,255,255,.05), 0 0 10px currentColor` (dark cut + soft glow, no white sticker halo).
4. **Phone screen**: replace hardcoded `#fff` in linear-gradient with `var(--surface)` and add `radial-gradient(circle at 50% 0%, rgba(215,25,32,.10), transparent 65%)` for subtle top wash.
5. **Visual flow steps**: surface-2 + `linear-gradient(180deg, #2a2f3c 0%, #1f2330 100%)` for proper elevation from body.
6. **Feature cards**: surface-2 + 1px line-soft border + 18% color-mix icon bg (lift from 12%).
7. **Final CTA**: gradient `linear-gradient(135deg, #ef4444 0%, #b8151b 50%, #7f0e12 100%)` + inset highlight + outer glow.
8. **Body wash**: `radial-gradient(1200px 600px at 20% -10%, rgba(215,25,32,.07), transparent 60%)` to break flat black.
9. **Clay shadow dark**: `8px 8px 22px rgba(0,0,0,.55), -4px -4px 12px rgba(255,255,255,.05), inset 0 1px 0 rgba(255,255,255,.07)`. Highlight must be ≥5% on dark.

### Forbidden in Dark Mode (per taste-skill §4.11 hierarchy parity)

- ❌ Pure `#000` or `#fff` background
- ❌ White halo on dots/chips (sticker tell)
- ❌ Brand-red `#d71920` on brand-red-50 bg (3.08:1 fail)
- ❌ Hardcoded `rgba(255,251,248,0.78)` nav bg (cream → dark body clash)
- ❌ Hardcoded `#fff` inside phone screen gradient
- ❌ AI-purple/blue glow gradients (taste-skill §4.2 LILA rule)
- ❌ `< 4.5:1` text contrast on any critical pair
