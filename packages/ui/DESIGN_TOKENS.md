# @sawaa/ui — Design Tokens Reference

This is the canonical reference for every design token used by `@sawaa/ui`
and the dashboard. The values are defined in
[`packages/ui/src/styles/globals.css`](./src/styles/globals.css) and
exposed via `@sawaa/ui/styles/globals.css`.

Apps MUST NOT redefine these tokens. Import the file from
`@sawaa/ui` and only add the Tailwind v4 bridge (`@theme inline`) and
app-scoped utilities locally.

---

## 1. Brand palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `#1E9E83` | `#7CD8C2` | Primary actions, brand accents |
| `--primary-foreground` | `#FFFFFF` | `#08312C` | Text on primary surfaces |
| `--primary-light` | `#7CD8C2` | `#9FE4D3` | Hover / lighter brand |
| `--primary-dark` | `#0E4B43` | `#55CCB0` | Pressed / darker brand |
| `--primary-ultra-light` | `rgba(30,158,131,0.10)` | `rgba(124,216,194,0.16)` | Tinted backgrounds (chips, blobs) |
| `--accent` | `#DCEAE6` | `#E7DBC4` | Secondary actions, highlights |
| `--accent-foreground` | `#2B3A39` | `#1B2522` | Text on accent surfaces |
| `--accent-ultra-light` | `rgba(30,158,131,0.08)` | `rgba(231,219,196,0.18)` | Tinted backgrounds |
| `--brand-warm` | `#C75D52` | `#E89A88` | Coral/terracotta break in the 10% slot |
| `--brand-warm-soft` | `#FBE7E2` | `rgba(232,154,136,0.16)` | Tinted backgrounds for warm accent |

---

## 2. Neutrals

| Token | Light | Dark |
|---|---|---|
| `--background` | `#F2F5F4` | `#0E1413` |
| `--foreground` | `#2B3A39` | `#F1F5F2` |
| `--surface` | `#FFFFFF` | `rgba(24,32,29,0.72)` |
| `--surface-solid` | `#FFFFFF` | `#1E2723` |
| `--surface-muted` | `#EFF4F3` | `#27302C` |
| `--surface-neutral` | `#F1F2F4` | `#2B3033` |
| `--muted` | `#E6F3EF` | `#27302C` |
| `--muted-foreground` | `#577069` (AA 4.88:1) | `#98A2B3` |
| `--card` | `var(--surface)` | `var(--surface)` |
| `--card-foreground` | `#2B3A39` | `#F1F5F2` |
| `--popover` | `#FFFFFF` | `rgba(24,32,29,0.92)` |
| `--popover-foreground` | `#2B3A39` | `#F1F5F2` |
| `--secondary` | `#E6F3EF` | `#1E2723` |
| `--secondary-foreground` | `#2B3A39` | `#F1F5F2` |

> `--card` is a shadcn-compat alias of `--surface`. Do **not** diverge.

---

## 3. Borders & focus

| Token | Light | Dark |
|---|---|---|
| `--border` | `#D7E8E2` | `rgba(255,255,255,0.12)` |
| `--border-strong` | `#BDD6CE` | `rgba(255,255,255,0.24)` |
| `--input` | `#C7DDD6` | `rgba(255,255,255,0.14)` |
| `--ring` | `rgba(30,158,131,0.32)` | `rgba(124,216,194,0.45)` |
| `--overlay` | `rgba(27,32,38,0.6)` | `rgba(0,0,0,0.60)` |

---

## 4. State colors

Each state has a full-saturation text token and a softer tinted token for
chip backgrounds (`bg-success-soft text-success`).

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--success` | `#15803D` | `#4ADE80` | Positive states |
| `--success-soft` | `#DCFCE7` | `rgba(74,222,128,0.16)` | Chip background |
| `--warning` | `#C2410C` | `#FB923C` | Cautionary states |
| `--warning-soft` | `#FFEDD5` | `rgba(251,146,60,0.16)` | Chip background |
| `--error` | `#C81E1E` | `#F87171` | Destructive/error (semantic) |
| `--error-soft` | `#FEE2E2` | `rgba(248,113,113,0.16)` | Chip background |
| `--destructive` | `var(--error)` | `var(--error)` | shadcn-compat alias — must mirror `--error` |
| `--info` | `#0369A1` | `#60A5FA` | Informational states |
| `--info-soft` | `#DBEAFE` | `rgba(96,165,250,0.16)` | Chip background |
| `--refunded` | `#6D28D9` | `#C4B5FD` | Refunded payments |
| `--refunded-soft` | `#EDE9FE` | `rgba(196,181,253,0.16)` | Chip background |

WCAG AA pairings (light mode, 11–14px text):
- success on success-soft: 4.57:1
- warning on warning-soft: 4.52:1
- error on error-soft: 4.70:1

---

## 5. Charts

5 categorical hues for data visualizations. Defined in both modes.

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `#15803D` | `#4ADE80` |
| `--chart-2` | `#0369A1` | `#60A5FA` |
| `--chart-3` | `#C2410C` | `#FB923C` |
| `--chart-4` | `#6D28D9` | `#C4B5FD` |
| `--chart-5` | `#DB2777` | `#F472B6` |

---

## 6. Sidebar

Scoped tokens for the sidebar surface. Override `--sidebar-*` only when
the sidebar diverges from the main page.

| Token | Light | Dark |
|---|---|---|
| `--sidebar` | `rgba(255,255,255,0.68)` | `rgba(24,32,29,0.72)` |
| `--sidebar-foreground` | `#2B3A39` | `#F1F5F2` |
| `--sidebar-primary` | `#1E9E83` | `#7CD8C2` |
| `--sidebar-primary-foreground` | `#FFFFFF` | `#08312C` |
| `--sidebar-accent` | `rgba(30,158,131,0.10)` | `rgba(124,216,194,0.16)` |
| `--sidebar-accent-foreground` | `#0E4B43` | `#7CD8C2` |
| `--sidebar-border` | `#D7E8E2` | `rgba(255,255,255,0.08)` |
| `--sidebar-ring` | `rgba(30,158,131,0.32)` | `rgba(124,216,194,0.45)` |

---

## 7. Shadows

Defined in `apps/dashboard/app/globals.css` (Bridge layer).

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 3px rgba(16,24,40,0.04)` |
| `--shadow-md` | `0 8px 24px rgba(16,24,40,0.06)` |
| `--shadow-lg` | `0 20px 60px rgba(16,24,40,0.08)` |
| `--shadow-primary` | `0 4px 12px var(--shadow-primary-color)` |
| `--shadow-primary-hover` | `0 6px 20px var(--shadow-primary-hover-color)` |
| `--shadow-primary-color` | `rgba(30,158,131,0.25)` (light) / `rgba(124,216,194,0.35)` (dark) |
| `--shadow-primary-hover-color` | `rgba(30,158,131,0.35)` (light) / `rgba(124,216,194,0.45)` (dark) |

---

## 8. Glassmorphism

| Token | Light | Dark |
|---|---|---|
| `--glass-blur` | `0px` | `0px` |
| `--glass-bg` | `#FFFFFF` | `rgba(24,32,29,0.72)` |
| `--glass-bg-solid` | `#FFFFFF` | `rgba(30,39,35,0.92)` |
| `--glass-border` | `#E4E7EC` | `rgba(255,255,255,0.08)` |

> Light mode uses solid white (no blur) for maximum contrast.

---

## 9. Radius

Squared, subtle curve. Defined in `@theme inline`.

| Token | Value |
|---|---|
| `--radius-sm` | `4px` |
| `--radius-md` | `6px` |
| `--radius-lg` | `8px` |
| `--radius-xl` | `10px` |
| `--radius-2xl` | `12px` |
| `--radius-3xl` | `14px` |

---

## 10. Decorative avatars

8 gradient pairs (from → to), used as decorative backgrounds for chat
bubble avatars. Distinct in light vs dark mode.

```css
--avatar-1-from: #55CCB0;  --avatar-1-to: #0E4B43;   /* light */
--avatar-1-from: #9ADB40;  --avatar-1-to: #B0EF60;   /* dark */
/* … 7 more pairs, see globals.css */
```

---

## 11. Rank colors

Gold / silver / bronze, used strictly for leaderboard / top-performer
badges. Decorative only — never use for semantic UI states.

Each rank has:
- `--rank-{gold,silver,bronze}-from` and `-to` (gradient stops)
- `--rank-{gold,silver,bronze}-border`
- `--rank-{gold,silver,bronze}-badge-from`, `-badge-to`, `-badge-text`, `-shadow`

---

## 12. How to consume

### In a Next.js app (dashboard)

```css
/* apps/dashboard/app/globals.css */
@import "@sawaa/ui/styles/globals.css";

@theme inline {
    --color-primary: var(--primary);
    /* … all the other Tailwind v4 mappings … */
}
```

### In a Tailwind v3 setup (legacy)

```css
/* tailwind.config.ts */
import { hair } from '@sawaa/ui/styles/globals.css';
```

Or copy the tokens into `tailwind.config.ts` `theme.extend.colors` if
your build pipeline can't import CSS directly.

---

## 13. Rules of engagement

1. **Never redefine tokens.** Always import from `@sawaa/ui`.
2. **Never use raw hex values in components.** Use `bg-primary`, not `bg-[#1E9E83]`.
3. **Prefer soft variants for chips.** Pair `bg-success-soft text-success`.
4. **Respect the `--destructive` ↔ `--error` alias.** They must always mirror.
5. **Color contrast is locked.** Don't tweak values without a WCAG re-audit.
6. **Dark mode overrides are paired.** Every light token has a dark counterpart.
