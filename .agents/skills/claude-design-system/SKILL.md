---
name: claude-design-system
description: |
  Official Anthropic Claude Design System extracted from OpenDesign. Provides warm tactile parchment aesthetics, terracotta brand accents, editorial serif + precision sans typography, and complete CSS tokens for crafting high-taste interfaces.
triggers:
  - "claude design"
  - "claude aesthetic"
  - "claude tokens"
  - "taste design"
  - "editorial ui"
---

# Claude Design System (Anthropic)

> Category: Brand Design System & Taste Guidelines
> Aesthetic: Literary salon, warm parchment canvas, terracotta brand accents, exclusively warm-toned neutrals.

## 1. Core Visual Tokens

### Surface & Background
- **Parchment Canvas** (`--bg: #F5F4ED`): The warm cream base for all page canvases. Never use pure `#FFFFFF` as a page background.
- **Ivory Surface** (`--surface: #FAF9F5`): Card containers, panels, and elevated surfaces.
- **Warm Sand** (`--surface-warm: #E8E6DC`): Interactive surfaces, secondary button backgrounds, table headers.

### Foreground & Typography
- **Anthropic Near Black** (`--fg: #141413`): Warmest black for headings and primary body.
- **Dark Warm** (`--fg-2: #3D3D3A`): Secondary titles, emphasized metadata.
- **Olive Gray** (`--muted: #5E5D59`): Body copy, labels.
- **Stone Gray** (`--meta: #87867F`): Subtle metadata, footnotes.

### Brand Accents
- **Terracotta Brand** (`--accent: #C96442`): Core brand action color, primary CTA, badges.
- **Coral Accent** (`--coral: #D97757`): Lighter text accent, warm signal.
- **Ivory on Accent** (`--accent-on: #FAF9F5`): High-contrast text on terracotta.

### Typography Hierarchy
1. **Headings**: Editorial Serif (`'Newsreader', Georgia, serif`) with generous letter-spacing and italic accents.
2. **Body & Controls**: Precision Grotesque Sans (`'Plus Jakarta Sans', -apple-system, sans-serif`).
3. **Data & Codes**: Technical Monospace (`'JetBrains Mono', 'SF Mono', monospace`).

### Ring-based Depth (No Muddy Shadows)
Use hairline borders (`border: 1px solid #E8E6DC`) and subtle ring-based containment:
```css
box-shadow: 0 1px 3px rgba(20, 20, 19, 0.03), 0 4px 12px rgba(20, 20, 19, 0.04);
```

## 2. Component Recipes

Refer to [`tokens.css`](./tokens.css), [`DESIGN.md`](./DESIGN.md), and [`components.html`](./components.html) in this directory for raw tokens and component implementations.
