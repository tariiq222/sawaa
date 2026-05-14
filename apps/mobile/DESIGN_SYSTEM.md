# Deqah Mobile — Design System

> **STATUS (2026-04-26):** Visual-language reference for the "Mental Health
> Home" prototype. The runtime tokens have since been ported to
> [`apps/mobile/theme/sawaa/`](theme/sawaa/) (`tokens.ts`). The deprecated
> `glass.ts` has been removed. The `src/*`
> paths referenced below are from the original prototype and no longer
> exist in this app — treat them as historical citations. Use this doc
> for the *principles*, and consult `apps/mobile/theme/sawaa/` for the
> currently-shipping values. App-level conventions live in
> [`CLAUDE.md`](CLAUDE.md).

Source of truth for the "Mental Health Home" visual language.

---

## 1. Principles

1. **Glass, not plastic** — semi-transparent layered surfaces; never flat white or opaque gray.
2. **Arabic-first** — RTL is not an afterthought; `writingDirection: 'rtl'` + logical-start alignment.
3. **Three tiers of everything** — shape, depth, and translucency each have exactly 3 levels. No free-form values.
4. **Apple-grade motion** — ease-out-quart only; animate `transform` + `opacity` only; no bounce/elastic.
5. **Tokens, not colors** — **STRICT: No inline hex codes (#...) allowed in components.** Every visual value must come from `sawaaTokens` or `sawaaColors`.

---

## 2. Color

Consult [`apps/mobile/theme/sawaa/tokens.ts`](theme/sawaa/tokens.ts) for the canonical palette.

### Core (Sawaa palette)

| Token | Use |
|---|---|
| `sawaaColors.teal[700]` | Primary text, icons, strong accents |
| `sawaaColors.teal[500]` | Secondary brand accent |
| `sawaaColors.ink[500]` | Secondary text, inactive icons |

### Background wash (top→bottom)

Applied via `AquaBackground` component. Uses a multi-stop gradient from `sawaaColors.teal`.

### Glass layer tokens

| Token | Role |
|---|---|
| `sawaaColors.glass.bg` | Default glass tint |
| `sawaaColors.glass.bgStrong` | Hero / CTA glass |
| `sawaaColors.glass.border` | Specular border |
| `sawaaColors.accent.coral` | Unread indicator / Errors |

### Semantic accents

| Accent | Token |
|---|---|
| Error | `sawaaColors.accent.coral` |
| Success | `sawaaColors.teal[500]` |
| Warning | `sawaaColors.accent.amber` |

---

## 3. Typography

**Font**: `IBM Plex Sans Arabic` — single family for display + body. Don't pair with a Latin family; weights within the family cover hierarchy.

**Scale** (fixed rem-equivalent; no fluid `clamp` in mobile):

| Role | Size | Weight | Line-height | Example |
|---|---|---|---|---|
| Display | 32 | 800 | 42 | Home greeting "مرحباً سارة" |
| Heading | 24 | 800 | 30 | Section titles |
| Subheading | 18 | 700 | 24 | Card titles |
| Body | 14 | 400 | 20 | Default body |
| Caption | 12 | 500 | 16 | Metadata, city names |
| Micro | 11 | 500–700 | 14 | Tab labels, tiny pills |

**Rules**:
- Arabic numerals only in UI (no `toLocaleString` pre-translation).
- All Arabic text: `textAlign: "right"`, `writingDirection: "rtl"`.
- `includeFontPadding: false` on any heading to kill Android top-space.

---

## 4. Shape (radius)

| Token | Value | Use |
|---|---|---|
| `sawaaTokens.radius.lg` | `20` | All content cards |
| `sawaaTokens.radius.xl` | `24` | Elevated surfaces (tab bar, hero panels) |
| `sawaaTokens.radius.md` | `16` | Images/Inputs nested inside cards |
| `sawaaTokens.radius.pill` | `999` | Fully-rounded capsules |

Only these values — no ad-hoc numbers.

---

## 5. Depth (shadow)

Shadows are now handled by the `Glass` component variants and the `sawaaTokens` system. **Avoid ad-hoc shadow styles.**

---

## 6. Glass (translucency)

Three variants, tuned in `apps/mobile/theme/sawaa/tokens.ts`:

| Variant | Typical use |
|---|---|
| `clear` | Tiny badges, inputs |
| `regular` | Default — all cards |
| `strong` | Floating bars, hero panels |

### 6.1 Press feedback

Handled by `<Glass interactive />`.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| Standard easing | `cubic-bezier(0.2, 0.9, 0.25, 1)` | Hover, press, micro-interactions |
| Stage easing | `cubic-bezier(0.32, 0.72, 0.15, 1)` | Large layout shifts (header search expand) |
| Short duration | `220ms` | Press, hover |
| Medium duration | `360ms` | Staged reveal |

---

## 8. Spacing

Consult `sawaaTokens.spacing`.

---

## 9. RTL

- Every `flexDirection: "row"` involving localized content becomes **`row-reverse`**.
- Every `Text` with Arabic content gets `textAlign: "right"` + `writingDirection: "rtl"`.
- Tab bar layout: `row-reverse` so Home tab sits on the RTL-start (right) side.
- Avoid hard-coded `left`/`right` offsets for UI chrome — use `start`/`end`-equivalent logic via `row-reverse`.

---

## 10. Components — canonical patterns

### 10.1 Card (content)

```tsx
<Glass variant="regular" radius={sawaaTokens.radius.lg}>
  <CardContent />
</Glass>
```

### 10.2 Floating bar (tab bar, hero panel)

```tsx
<Glass variant="strong" radius={sawaaTokens.radius.pill} style={{ bottom: 14 }}>
```

### 10.3 Pill / capsule

```tsx
<Glass variant="regular" radius={sawaaTokens.radius.pill}>
```

### 10.4 Rating pill

```tsx
<View style={{ backgroundColor: sawaaColors.glass.bgSoft, borderRadius: 999 }}>
  <Ionicons name="star" color={sawaaColors.accent.amber} />
  <Text style={{ color: sawaaColors.teal[700] }}>4.8</Text>
</View>
```
