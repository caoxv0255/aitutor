# AI Tutor (智启AI导师) Design System

A design system for **AI Tutor** -- an AI-powered education platform that provides adaptive learning, error analysis, and predictive exam preparation for students. The system is purpose-built for a student-facing dashboard and learning management interface, balancing data-dense information (scores, weak-point analytics) with an approachable, action-oriented UI.

## What this design system covers

- **Foundations** -- 6 color scales (primary red, blue, success, info, warning, error), 5-level elevation, 8-step spacing, 4 radius tokens, full light/dark theme support
- **Components** -- 6 documented components: Button, Card, Input, Navigation, Tag, StatCard
- **Preview pages** -- self-contained HTML specimens for every component in `preview/`

## CONTENT FUNDAMENTALS

### Voice & tone

The product speaks to students in a direct, encouraging register. Copy is concise, task-oriented, and free of decorative language -- it tells the student what the feature does and what action to take next. Tone leans professional but warm: instructional rather than mechanical. Bilingual context (CN-first) with Latin numerals and labels appearing in English where conventional (e.g., "AI Tutor" brand name, stat labels). No emoji in product UI.

### Concrete copy examples (lifted from the component previews)

- Card heading: *"我的错题本"* -- body: *"记录和分析你的错题，帮助针对性复习薄弱知识点。"*
- Card heading: *"薄弱点分析"* -- body: *"智能检测知识盲区，生成个性化提升方案。"*
- Navigation links: *"首页"*, *"预测卷"*, *"错题本"*, *"AI讲题"*
- Button primary CTA: *"开始学习"* -- ghost secondary: *"取消"*
- StatCard labels: *"综合得分"*, *"薄弱知识点"*, *"考点覆盖"*, *"本周提升"* (change: *"较上周"*)
- Input labels: *"题目内容"*, *"用户名"*, *"搜索知识点"*
- Tag subjects: *"数学"*, *"物理"*, *"化学"*, *"英语"* -- topics: *"导数与切线"*, *"三角函数"*

### When generating copy

- Use verb-first imperatives for CTAs ("开始学习", not "点击开始学习")
- Card descriptions follow a pattern: feature summary + benefit clause ("记录和分析你的错题，帮助针对性复习薄弱知识点")
- Stat labels are noun phrases, never sentences ("综合得分", not "你的综合得分为")
- Subject tags map to school curriculum subjects; topic tags reference specific knowledge points

## VISUAL FOUNDATIONS

### Color

The system is built around a bold red primary (`#d71920`) that signals urgency and academic focus, paired with a complementary blue (`#2563eb`) used for secondary actions and informational states. This is not a generic SaaS palette -- the red is intentionally warm and saturated, evoking the urgency of exam preparation and the energy of active learning.

- **Brand primary:** `#d71920` (AI Tutor Red) -- used for primary buttons, active navigation accents, interactive card borders on hover, and the accent StatCard variant. The hover darkens to `#b8151b`. This red anchors the entire visual identity; there is no alternate brand accent.
- **Brand scale:** 10 stops from `#fff1f1` (50) through `#660f13` (900). The working range clusters around `#d71920` (500) for fills and `#b8151b` (600) for hover, with `#fff1f1` (50) serving as the primary container background.
- **Blue secondary:** `#2563eb` -- a conventional blue used for secondary actions, informational tags, and links. Its own 10-stop scale mirrors the primary structure. Does not compete with the red; provides calm contrast.
- **Neutrals:** The foreground is a dark navy `#1a1a2e` (not pure black), with muted text at `#94a3b8` and borders at `#e2e8f0`. The surface hierarchy runs from `#ffffff` through `#d5dae1`, creating depth without heavy shadow reliance. Dark theme inverts to `#0f1117` background with `#e8ecf1` foreground.
- **Semantic colors:** Success `#059669`, Warning `#f59e0b`, Error `#ef4444`, Info `#0284c7`. Each follows the same 10-stop pattern. Success appears in StatCard change indicators; Error handles validation states.
- **Vibe:** Confident and structured. The warm red gives personality and draws attention to key interactions, while the cool neutrals and blue secondary keep the information-heavy dashboard from feeling chaotic. The palette is deliberately restrained -- no gradients, no accent surprises.

### Typography

The type system uses **DM Sans** for display/heading roles and **Noto Sans SC** as the primary body face for Chinese content. This pairing balances Latin geometric clarity with CJK readability.

- **Primary face:** **Noto Sans SC** -- the default for body text, inputs, and any content-heavy context. Weight 400 for body, with 500 used sparingly for input labels. This is the workhorse of the system; if only one font loads, this should be it.
- **Display / heading face:** **DM Sans** -- used for all heading levels (h1-h4), display text, stat numbers, and the brand logo in the navigation. DM Sans's geometric construction gives headings a modern, slightly technical character that pairs well with the data-dense dashboard context.
- **Mono face:** **DM Sans** (monospace fallback) -- reserved for code and numeric displays. The `font-variant-numeric: tabular-nums` declaration on the `.aitutor-price` class hints at the importance of aligned number columns in stat contexts.
- **Scale:** Display 56px/1.1, H1 40px/1.2, H2 32px/1.25, H3 24px/1.3, H4 20px/1.4, Lead 18px/1.7, Body 16px/1.6, Mono 14px/1.6, Caption 12px/1.5, Eyebrow 11px/1.4 (uppercase, letter-spacing 0.08em). The scale is modular and has clear rhythm: display and h1 are bold (700), h2-h4 are semibold (600), body and below are regular (400).
- **Line-height strategy:** Tight for display (1.1), gradually opening through headings to a spacious 1.7 for lead text. This creates clear hierarchy without relying on weight alone.

### Spacing

Base unit is 4px. Tokens: `--space-1` (4px) through `--space-8` (64px), with gaps at 20px and 40px (those sizes are not in the token set). Inputs default to 40px height (`--size-input-height`); buttons come in three tiers: 32px (sm), 40px (md), 48px (lg). The most frequently used spacing in components is `--space-3` (12px) for internal gaps, `--space-5` (24px) for section padding, and `--space-6` (32px) for card padding. The 4px base makes cross-component alignment predictable.

### Radius

- **8px** (`--radius-sm`) -- used for inputs, search wraps, navbar links, and the navbar CTA button. The "sharp enough to feel precise" tier.
- **14px** (`--radius-md`) -- the default for cards, StatCards, and any larger container. Gives enough softness for a dashboard tile without looking pillowy.
- **16px** (`--radius-lg`) -- defined but not heavily used in the current component set; reserved for larger panels or modals.
- **9999px** (`--radius-pill`) -- used exclusively for buttons and tags. This is the system's signature shape: all buttons are pills, all tags are pills. The pill form is a deliberate brand choice that separates AI Tutor's interactive elements from its container elements.

### Shadow / Elevation

5 layers, progressing from barely-there to full overlay:

1. **shadow-1 (Card):** `0 1px 2px rgba(0,0,0,.06), 0 1px 1px rgba(0,0,0,.04)` -- the default resting state for cards and StatCards. Whisper-quiet.
2. **shadow-2 (Card Hover):** `0 4px 8px -2px rgba(0,0,0,.10)` -- interactive cards lift to this on hover, paired with a `translateY(-3px)` transform.
3. **shadow-3 (Float):** `0 8px 24px -8px rgba(0,0,0,.18)` -- for elevated content like dropdowns or tooltips.
4. **shadow-4 (Modal):** `0 16px 40px -12px rgba(0,0,0,.24)` -- modal dialogs.
5. **shadow-5 (Overlay):** `0 24px 60px -20px rgba(0,0,0,.30)` -- full-screen overlays.

The philosophy is "shadow as proximity, not decoration." Elements at rest use shadow-1 or none. Elevation signals interaction state, not importance.

### Borders

Borders are 1px solid using `--color-outline` (`#e2e8f0` light / `#2a2d38` dark). The accent StatCard variant uses a 2px primary border for emphasis. No dashed or dotted borders in the system. The navbar uses a bottom border with the theme border color. Interactive cards change border-color to `--color-primary` on hover.

### Animation

All transitions are 150ms (`0.15s`) across background, border-color, opacity, box-shadow, filter, and transform. No easing curve is explicitly declared (defaults to `ease`). The consistent 150ms gives the system a snappy, responsive feel without jarring motion. The `translateY(-3px)` on interactive card hover is the only transform in the system.

### Iconography

Icons are sourced from Lucide (1.8.0). The system defines three icon sizes: 16px (sm), 24px (md), 32px (lg). Interactive cards use the lg size for their leading icon. The search input wrap uses an md icon. All icons inherit their color from the parent's `color` property via `currentColor`.

## Component Patterns

| Component | Preview | Contract | CSS Source | Key Facts | Key Insight |
|---|---|---|---|---|---|
| Button | `preview/component-button.html` | `components/button.json` | `components.css` section `Button` | Primary/ghost variants; sm/md/lg sizes; pill radius; disabled at 0.4 opacity | All buttons are pills -- pill radius is the signature shape |
| Card | `preview/component-card.html` | `components/card.json` | `components.css` section `Card` | Default + interactive variant; 260px width; hover lifts 3px with shadow-2 | Interactive cards change border to primary on hover, combining color + elevation |
| Input | `preview/component-input.html` | `components/input.json` | `components.css` section `Input` | Text input (8px radius) + search wrap (pill radius); focus border = primary | Two radius treatments: standard for plain inputs, pill for search |
| Navigation | `preview/component-navigation.html` | `components/navigation.json` | `components.css` section `Navigation` | Desktop + mobile compact; 60px height; backdrop-blur(16px) dark bg | Dark nav on light theme -- fixed contrast, not theme-adaptive |
| Tag | `preview/component-tag.html` | `components/tag.json` | `components.css` section `Tag` | Default + 4 color variants; 24px height; pill radius; 600 weight | Color-coded by subject: primary=math, blue=physics, success=chemistry, info=english |
| StatCard | `preview/component-stat-card.html` | `components/stat-card.json` | `components.css` section `Stat Card` | Default + accent variant; centered layout; DM Sans display for numbers | Accent variant uses primary container bg + 2px primary border for emphasis |

## Index

- `README.md` -- this file (brand narrative and visual reference)
- `colors_and_type.css` -- single CSS import for all design tokens (color, type, radius, shadow, spacing, dark theme)
- `components.css` -- aggregated component CSS extracted from preview pages
- `css.json` -- structured JSON token representation for programmatic consumption
- `preview/` -- self-contained HTML specimen pages, one per component
- `components/` -- component contract JSON files (intent/variants/states)
- `SKILL.md` -- AI agent skill manifest (entry point for downstream consumption)

## Caveats / known substitutions

1. **DM Sans** is loaded via Google Fonts CDN (`fonts.googleapis.com`). If offline deployment is required, the font files must be self-hosted. Without DM Sans, the system falls back through Noto Sans SC to `sans-serif` -- headings will lose their geometric character but remain readable.
2. **Noto Sans SC** is likewise CDN-loaded. For Windows environments where Google Fonts access may be restricted, consider bundling the WOFF2 files locally. Noto Sans SC covers Simplified Chinese; Traditional Chinese and other CJK scripts will fall back to the OS default.
3. **Icons** use Lucide 1.8.0 via CDN (`unpkg.com`). The preview pages include `lucide.min.js` for icon rendering. Production usage should either bundle the SVG sprites or use a tree-shaken package. The current icon set is not exhaustive -- only icons used in specimens are verified.
4. **Brand file** (phase2-brand-analyst.json) was empty at generation time. All copy examples, voice/tone analysis, and personality observations are derived from the component preview HTML content only, not from an upstream brand brief. If a brand brief becomes available, the Content Fundamentals section should be updated.
5. **Component contracts** are `from-scratch` with `medium` confidence. No Figma evidence archive exists. Variant coverage is inferred from CSS class inspection, not from a design tool export.
