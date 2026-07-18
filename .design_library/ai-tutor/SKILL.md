---
name: ai-tutor-design
description: Use this skill to generate well-branded interfaces for AI Tutor (智启AI导师). Contains colors, type, fonts, assets, and UI kit for prototyping dashboard UIs.
user-invocable: true
---
# AI Tutor Design Skill

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts, copy assets out and create static HTML files. If working on production code, read the rules here to become an expert in designing with this brand.

## Quick map
- `README.md` — brand context, content fundamentals, visual foundations (read first)
- `css.json` — structured token understanding source
- `colors_and_type.css` — drop-in CSS variables for colors, type, radius, shadow, spacing
- `components/index.json` — component index + cross-component patterns
- `preview/` — small HTML cards illustrating foundations and components
- `ui_kits/dashboard/` — full click-thru recreation (only if generatedArtifacts contains ui_kits files)
- `library-consumption.json` — recommended downstream read order

## Essentials at a glance
- Brand primary `#d71920` — vivid red, educational energy, high contrast on dark backgrounds. No warm secondary; blue `#2563eb` serves as secondary accent.
- Radius 8/14/16/9999px — compact controls (8px), standard cards (14px), large surfaces (16px), pill tags (9999px).
- 4px spacing grid (4–64px), 40px default control/input height, 48px large button, normal density.
- Type: DM Sans (Latin display & headings); Noto Sans SC (Chinese/CJK body); DM Sans mono for code. Scale: 56/40/32/24/20/16/18/12/11px.
- Voice: Chinese-first, professional, motivational, data-focused, no emoji in UI.
- Shadows: 5 levels from subtle card (`0 1px 2px rgba(0,0,0,.06)`) to deep overlay (`0 24px 60px rgba(0,0,0,.30)`).
- Dark theme is first-class: surface `#1a1d27`, background `#0f1117`, borders `#2a2d38` — designed for dashboard-heavy usage.

## Components

Agents consume component sources in priority order: `preview/component-{slug}.html` first, `components/{slug}.json` for intent/variants, and `_evidence/{slug}.json` as fallback evidence. `css.json` is the token understanding source; `colors_and_type.css` is the runtime link source.

| Slug | Name | Key Insight |
|------|------|-------------|
| button | Button | Primary red CTA + ghost secondary, pill shape |
| card | Card | Dark bordered card with hover lift for dashboard tiles |
| input | Input | Dark input with red focus glow, search variant |
| navigation | Navigation | Sticky top nav, backdrop blur, 60px height |
| tag | Tag | Pill-shaped subject/knowledge-point labels |
| stat-card | StatCard | Large number display for dashboard metrics |
