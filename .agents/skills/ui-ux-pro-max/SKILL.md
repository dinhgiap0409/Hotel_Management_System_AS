---
name: ui-ux-pro-max
description: |
  UI/UX design intelligence engine for web, mobile, and desktop applications. Searchable offline database covering 79 visual styles, 192 product palettes and reasoning profiles, 74 font pairings, 119 UX guidelines, 105 icons, 17 GSAP presets, 25 chart types, and 22 technology stacks. Powered by zero-dependency local Python scripts.
triggers:
  - "ui ux pro max"
  - "design recommendation"
  - "ux guidelines"
  - "color palette recommendation"
  - "typography pairing"
  - "chart recommendation"
---

# UI-UX Pro Max Design Intelligence

Comprehensive UI/UX design intelligence system with local offline database covering styles, palettes, typography pairings, UX best practices, accessibility standards, and framework-specific patterns.

## Prerequisites

The bundled search engine requires Python 3 (standard library only — no external dependencies, no network access).
Command path:
```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py [query] [options]
```

## CLI Usage & Capabilities

### 1. Generating a Full Design System Recommendation
```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<product or industry>" --design-system --project-name "<name>"
```
Options:
- `--variance 1-10`: 1 = centered/minimal, 10 = bold/asymmetric
- `--motion 1-10`: 1 = subtle micro-interactions, 10 = complex cinematic
- `--density 1-10`: 1 = spacious marketing, 10 = dense enterprise dashboard

### 2. Searching by Specific Domain
```bash
# Domain choices: style, color, chart, landing, product, ux, typography, icons, gsap, react, web, google-fonts
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "hotel booking" --domain product
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "warm editorial" --domain style
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "terracotta" --domain color
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "occupancy rates" --domain chart
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "inline error validation" --domain ux
```

### 3. Stack-Specific Guidelines
```bash
# Stack choices: react, nextjs, vue, svelte, astro, html-tailwind, etc.
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "table pagination" --stack html-tailwind
```

---

## Priority UX Rules & Standards

| Priority | Category | Impact | Domain | Key Checks (Must Have) | Anti-Patterns (Avoid) |
|---|---|---|---|---|---|
| 1 | Accessibility | CRITICAL | `ux` | Contrast >= 4.5:1, Alt text, Keyboard nav, Focus rings | Removing focus outline, Icon-only buttons without aria-label |
| 2 | Touch & Interaction | CRITICAL | `ux` | Min touch target 44×44px, >= 8px spacing, Loading feedback | Reliance on hover only, Instant 0ms state flashes |
| 3 | Performance | HIGH | `ux` | WebP/SVG, Lazy loading, Reserve space (CLS < 0.1) | Layout thrashing, Cumulative layout shifts on load |
| 4 | Style Selection | HIGH | `style`, `product` | Match industry semantics, SVG icons (no emojis) | Mixing flat & skeuomorphic randomly, Emojis as UI icons |
| 5 | Layout & Responsive | HIGH | `ux` | Mobile-first breakpoints, Viewport meta, No horizontal scroll | Horizontal scrollbars, Fixed px container widths |
| 6 | Typography & Color | MEDIUM | `typography`, `color` | Base 16px, Line-height 1.5, Semantic color tokens | Text < 12px, Gray-on-gray unreadable text, Raw hex sprawl |
| 7 | Animation | MEDIUM | `ux` | Purposeful easing, 150-300ms durations, prefers-reduced-motion | Infinite bouncing animations, Animating width/height |
| 8 | Forms & Feedback | MEDIUM | `ux` | Visible floating/top labels, Inline errors near input, Helper text | Placeholder-only labels, Errors only shown at top summary |
| 9 | Navigation | HIGH | `ux` | Predictable back behavior, Clear active states, Breadcrumbs | Mystery meat navigation, Broken back button |
| 10 | Charts & Data | LOW | `chart` | Legends, Interactive tooltips, Accessible colors | Color alone conveying state without text or patterns |
