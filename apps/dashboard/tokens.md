# Sawaa Dashboard — Design Tokens

**Single source of truth** for every design token used in the dashboard.
If a token exists in code but not here, it's a bug in this doc — update it.

- **Token values** live in [`app/globals.css`](./app/globals.css) as CSS custom properties
- **Type-safe references** live in [`lib/ds.ts`](./lib/ds.ts)
- **Tailwind mapping** happens inside the `@theme inline` block in `globals.css`
- **Runtime branding overrides** are injected by `BrandingProvider` via a `#sawaa-dark-theme` style tag

> Branding rule: clinic deployments override **brand tokens only** (`--primary`, `--accent`, `--ring`, `--sidebar-*`). Neutrals, states, and decorative tokens stay fixed.

---

## 1. Brand Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `#354FD8` | injected | Primary CTA, links, focus rings, sidebar active |
| `--primary-foreground` | `#FFFFFF` | `#FFFFFF` | Text on primary surfaces |
| `--primary-light` | `#5B72E8` | — | Hover/highlight variant of primary |
| `--primary-ultra-light` | `rgba(53,79,216,0.08)` | — | Primary-tinted backgrounds (chips, selected rows) |
| `--accent` | `#82CC17` | injected | Secondary highlight — badges, indicators only |
| `--accent-foreground` | `#1B2026` | — | Text on accent surfaces |
| `--accent-ultra-light` | `rgba(130,204,23,0.10)` | — | Accent-tinted backgrounds |

**Rules**

- `primary` **leads** — it's the one CTA per region.
- `accent` **highlights** — never use as a CTA or wide background.
- Never hardcode `#354FD8` or `#82CC17` in JSX. Always use tokens so branding works.

---

## 2. Neutrals & Surfaces

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `#F2F4F8` | `#0F1117` | Page background |
| `--foreground` | `#1B2026` | `#F1F4F8` | Primary text |
| `--surface` | `rgba(255,255,255,0.72)` | `rgba(27,32,38,0.72)` | Card/panel glass surface |
| `--surface-solid` | `#FFFFFF` | `#252B33` | Solid fallback for non-glass surfaces |
| `--surface-muted` | `#F7F9FC` | `#2E3540` | Nested sections inside a card |
| `--muted` | `#F1F4F8` | `#2E3540` | Hover state, skeleton, inactive chip background |
| `--muted-foreground` | `#667085` | `#98A2B3` | Secondary/helper text |
| `--card` | alias of `--surface` | alias of `--surface` | shadcn compat — **do not diverge** |
| `--card-foreground` | `#1B2026` | `#F1F4F8` | Text inside cards |
| `--popover` | `rgba(255,255,255,0.92)` | `rgba(27,32,38,0.92)` | Popover/dropdown surface (higher opacity than card) |
| `--popover-foreground` | `#1B2026` | `#F1F4F8` | Text in popovers |
| `--border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.12)` | Default border |
| `--border-strong` | `#D0D5DD` | `rgba(255,255,255,0.24)` | Stronger borders (inputs, dividers) |
| `--input` | `#D0D5DD` | `rgba(255,255,255,0.14)` | Form input borders |
| `--ring` | `rgba(53,79,216,0.28)` | injected | Focus ring |
| `--overlay` | `rgba(27,32,38,0.6)` | `rgba(0,0,0,0.60)` | Modal/sheet backdrop |

### Surface Hierarchy (max 3 levels per screen)

```
bg-background         ← the page itself
  bg-surface / bg-card ← cards and panels
    bg-surface-muted   ← nested sections inside a card
```

### muted vs surface-muted (the subtle distinction)

- **`--muted`** (`#F1F4F8`) — *interaction* background. Hover states, skeletons, inactive chips. Slightly darker.
- **`--surface-muted`** (`#F7F9FC`) — *structural* background. Nested sections, secondary zones inside cards. Slightly lighter.

They look nearly identical (2 luminance points apart) and **that's intentional**. Keep them distinct; don't merge.

---

## 3. State Colors

| Token | Light | Dark | Semantic |
|-------|-------|------|----------|
| `--success` | `#15803D` | `#4ADE80` | Positive confirmations, active status |
| `--success-soft` | `#DCFCE7` | `rgba(74,222,128,0.16)` | Vivid chip background for success state |
| `--warning` | `#C2410C` | `#FB923C` | Caution, pending states |
| `--warning-soft` | `#FFEDD5` | `rgba(251,146,60,0.16)` | Vivid chip background for warning state |
| `--error` | `#DC2626` | `#F87171` | Errors, failures, destructive actions |
| `--error-soft` | `#FEE2E2` | `rgba(248,113,113,0.16)` | Vivid chip background for error state |
| `--info` | `#0369A1` | `#60A5FA` | Informational callouts |
| `--info-soft` | `#DBEAFE` | `rgba(96,165,250,0.16)` | Vivid chip background for info state |
| `--refunded` | `#6D28D9` | `#C4B5FD` | Refunded payments |
| `--refunded-soft` | `#EDE9FE` | `rgba(196,181,253,0.16)` | Vivid chip background for refunded state |
| `--destructive` | alias of `--error` | alias of `--error` | **shadcn-compat alias only** |

### destructive vs error — the rule

| Use `destructive` when... | Use `error` when... |
|---------------------------|---------------------|
| Calling a shadcn variant (`Button variant="destructive"`, `Badge variant="destructive"`) | Writing custom classes or new components |
| Styling `DropdownMenuItem variant="destructive"` | Writing badges, alerts, status indicators |

`--destructive` is wired with `var(--error)` in `globals.css` — the two will always be identical. New code should prefer the `error` name for clarity.

### State Color Background Convention

Two equally-valid ways to tint a status chip, pick by contrast need:

```ts
// 1. Soft solid (preferred for chips/badges — vivid, hue-clear, survives the
//    brand-tinted page background #EAF8F4).
bg-success-soft       // tinted background, ~hue 110 chroma
text-success          // full-saturation foreground (label)
border-success/40     // subtle border
border-s-success      // 3px logical-start accent for sharp color anchor

// 2. Opacity tint (legacy — kept for hover/ghost states where a soft hint is wanted)
bg-success/10
text-success
border-success/20
```

The `*-soft` tokens are vivid, opaque light pastels in light mode and 16%-alpha
glow in dark mode. Use them for any chip/badge that needs to *read* as a color
(booking status, payment status, action intents). The opacity-tint form
(`bg-*/10`) is best for hover ghosts, focus halos, and very large surfaces
where a saturated fill would be too loud.

Same pattern for `warning`, `error`, `info`, `refunded`. See [`ds.ts`](./lib/ds.ts)
`stateColors` and `bookingStatusStyles`.

---

## 4. Typography

- **Font**: `IBM Plex Sans Arabic, sans-serif` (set via `--font-arabic` → `--font-sans` and `--font-heading`)
- **Minimum important text size**: 14px (`text-sm`). Never go below on user-facing information.
- **Headings**: `font-semibold` (600)
- **Numbers, dates, amounts**: add `tabular-nums` (or the `font-numeric` class)

| Size | Tailwind | Pixels | Usage |
|------|----------|--------|-------|
| xs | `text-xs` | 12px | Captions, labels, chip text |
| sm | `text-sm` | 14px | Body, table cells (minimum) |
| md | `text-base` | 16px | Body on mobile, prominent text |
| lg | `text-lg` | 18px | Card subtitles |
| xl | `text-xl` | 20px | H1 (page titles) |
| 2xl | `text-2xl` | 24px | Large stat numbers |
| 3xl | `text-3xl` | 30px | Hero figures |

| Weight | Class | Usage |
|--------|-------|-------|
| 400 | `font-normal` | Body |
| 500 | `font-medium` | Emphasized body |
| 600 | `font-semibold` | All headings |
| 700 | `font-bold` | Extreme emphasis only |

---

## 5. Spacing (8px Grid)

All spacing must land on the 8px grid. Avoid arbitrary values like `gap-[13px]`.

| Tailwind | Pixels |
|----------|--------|
| `*-1` | 4px |
| `*-2` | 8px |
| `*-3` | 12px |
| `*-4` | 16px |
| `*-5` | 20px |
| `*-6` | 24px |
| `*-8` | 32px |
| `*-10` | 40px |
| `*-12` | 48px |

**RTL rule**: never use `pl-/pr-/ml-/mr-/left-/right-`. Use logical equivalents: `ps-/pe-/ms-/me-/start-/end-`.

---

## 6. Radius

Defined in `globals.css` `@theme` block. Keep [`ds.ts`](./lib/ds.ts) `radius` map in sync.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `8px` | Chips, pills, table action buttons |
| `--radius-md` | `12px` | Inputs, buttons |
| `--radius-lg` | `16px` | Cards, data tables |
| `--radius-xl` | `20px` | Modals, large surfaces |
| `--radius-2xl` | `24px` | Hero surfaces, feature cards |
| `--radius-3xl` | `28px` | Decorative shells |

---

## 7. Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Cards at rest — `0 1px 3px rgba(16,24,40,0.04)` |
| `--shadow-md` | Dropdowns, popovers, cards on hover — `0 8px 24px rgba(16,24,40,0.06)` |
| `--shadow-lg` | Modals only — `0 20px 60px rgba(16,24,40,0.08)` |
| `--shadow-primary` | Primary CTA glow — `0 4px 12px var(--shadow-primary-color)` |
| `--shadow-primary-hover` | Primary CTA glow on hover |

**Never** use pure black shadows or hardcoded `shadow-[...]` values outside these tokens.

---

## 8. Glassmorphism

| Token | Value | Usage |
|-------|-------|-------|
| `--glass-bg` | `rgba(255,255,255,0.72)` / `rgba(27,32,38,0.72)` | Standard glass — cards, sidebar |
| `--glass-bg-solid` | `rgba(255,255,255,0.88)` | Higher opacity — popover, dropdown |
| `--glass-blur` | `24px` | `backdrop-filter: blur(24px)` |
| `--glass-border` | `rgba(0,0,0,0.06)` | Glass edge border |

Utility classes (defined in `globals.css`):

- `.glass` — standard frosted glass
- `.glass-solid` — higher opacity variant
- `.glass-strong` — strongest variant

---

## 9. Decorative Tokens (non-semantic)

These are **not** part of the semantic system. Do not use for UI states or branding.

### Avatar gradients

`--avatar-1-from` / `--avatar-1-to` through `--avatar-8-from/to` — 8 decorative gradient pairs used by `getAvatarGradientStyle(id)` in [`lib/utils.ts`](./lib/utils.ts) to deterministically color user avatars.

### Rank colors (leaderboard/top-performers only)

Used by [`components/features/employees/top-performers.tsx`](./components/features/employees/top-performers.tsx).

| Rank | From | To | Border | Badge |
|------|------|----|--------|----|
| Gold (1st) | `--rank-gold-from` | `--rank-gold-to` | `--rank-gold-border` | `--rank-gold-badge-from/to/text` |
| Silver (2nd) | `--rank-silver-from` | `--rank-silver-to` | `--rank-silver-border` | `--rank-silver-badge-from/to/text` |
| Bronze (3rd) | `--rank-bronze-from` | `--rank-bronze-to` | `--rank-bronze-border` | `--rank-bronze-badge-from/to/text` |

Each rank also has `--rank-{color}-shadow` for the badge glow.

### Chart series

`--chart-1` through `--chart-5` — used by Recharts. Ordered for maximum distinction, not semantic meaning. Do not reuse for UI states.

---

## 10. Banned Patterns

| ❌ Never | ✅ Instead |
|---------|-----------|
| Hex colors in JSX | Semantic tokens |
| `text-gray-500`, `bg-gray-100` | `text-muted-foreground`, `bg-muted` |
| `<input>`, `<select>`, `<textarea>` raw | shadcn primitives |
| Inline `style={{ color: "..." }}` | Tailwind classes mapped to tokens |
| Hardcoded shadows `shadow-[...]` | `shadow-sm/md/lg/primary` |
| `pl-/pr-/ml-/mr-/left-/right-` | `ps-/pe-/ms-/me-/start-/end-` |
| `any` in TypeScript | Proper types |
| Files over 350 lines | Split immediately |

---

## 11. Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | State color refresh for booking-page readability. Bumped `--success`/`--warning`/`--error`/`--info`/`--refunded` to more vivid, slightly more saturated values that still pass WCAG AA on white. Added `*-soft` tokens (vivid light pastels in light mode, 16%-alpha glows in dark mode) for chip backgrounds. Migrated `bookingStatusStyles`, `bookingTypeStyles`, `paymentStatusStyles`, and `StatCard` icon tile to the `*-soft` pattern with a 3px logical-start accent (`border-s-*`). Colorized the action icon buttons in the bookings table by intent (approve=success, reject=error, view/edit/invoice=primary, delete=error-on-hover). |
| 2026-04-11 | Initial version. Resolved `destructive`/`error` conflict (alias). Aliased `--card` → `--surface`. Added `--rank-silver-*` tokens. Fixed `bg-muted/10` → `bg-muted` in `bookingStatusStyles.expired`. Added `2xl`/`3xl` to `ds.ts` radius map. |
