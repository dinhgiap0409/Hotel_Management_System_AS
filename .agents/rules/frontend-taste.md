# Frontend Design Taste & Aesthetic Rules (Claude Design Standards)

This project enforces high-taste, anti-slop frontend design standards derived from **Anthropic Claude Design** and **OpenDesign**. When creating, redesigning, or refining any web page, component, or screen mockup in this repository:

---

## 1. Zero Tolerance for AI Slop Defaults
- **NO Generic Tech Blue**: Do not default to `#2563eb`, `#1890ff`, or generic Bootstrap blue.
- **NO Purple-Blue Gradients**: Never use nebulous, floating purple/cyan gradient blobs behind cards.
- **NO Muddy Gray Shadows**: Never use heavy, blurred black shadows (`box-shadow: 0 10px 30px rgba(0,0,0,0.5)`). Use delicate ring-based borders (`border: 1px solid #E8E6DC`) and subtle warm ambient depth.
- **NO Cliché Rounded Bubbles**: Avoid over-rounded `border-radius: 9999px` cards on desktop dashboards. Use disciplined `8px` to `14px` border radiuses.

---

## 2. Palette: Warm, Tactile & Literary (Claude Design Language)
- **Canvas Base**: Warm Parchment (`#F5F4ED`) or Oatmeal Cream (`#FAF9F5`). Never use pure `#FFFFFF` or cold `#F1F5F9` as full page backgrounds.
- **Elevated Surfaces**: Ivory (`#FAF9F5`) and Warm Sand (`#E8E6DC`).
- **Foreground Text**: Deep Warm Charcoal (`#141413`), Dark Warm (`#3D3D3A`), Olive Gray (`#5E5D59`).
- **Primary Brand Accent**: Terracotta / Burnt Sienna (`#C96442` or `#CC5A36`).
- **Borders**: Delicate, warm hairline borders (`#E8E6DC`, `#F0EEE6`).

---

## 3. Typographic Craft
- **Headlines & Titles**: Always pair with an **Editorial Serif** font (`'Newsreader', 'Georgia', serif`). Use italics for expressive words to convey luxury, hospitality, and literary elegance.
- **Forms, Labels & Controls**: Use a clean, precision **Grotesque Sans-Serif** (`'Plus Jakarta Sans'`, `-apple-system`, `'Inter'`).
- **Data, Codes & Prices**: Format booking codes, room numbers, and currency using a clean **Monospace** font (`'JetBrains Mono'`, `'SF Mono'`, monospace).

---

## 4. Callout Badges & Engineering Traceability
- Callout badges `(1), (2), (3)...` must use the signature **Terracotta pill style** (`background: #C96442; color: #FAF9F5; box-shadow: 0 2px 4px rgba(201,100,66,0.3)`).
- Every input control and action button must trace 1-to-1 to a database entity (`[DB Mapping: tbl_name.column_name]`) or API endpoint in the System Architecture and Database Design.
