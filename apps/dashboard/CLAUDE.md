# Sawaa Dashboard — Next.js Admin

## Tech

Next.js 15 (App Router), React 19, TanStack Query v5, Tailwind 4, Zod, React Hook Form. UI primitives come from the workspace `@sawaa/ui` package name. Custom i18n runtime — `next-intl` is installed but not used at runtime.

## Layer Rules (strict — no exceptions)

```
app/(dashboard)/[feature]/page.tsx     ≤150 lines — orchestration only
    ↓ imports from
components/features/[feature]/         ≤300 lines per file
components/features/shared/            shared across 3+ features
@sawaa/ui                            shadcn primitives — DO NOT MODIFY
components/ui/                         app-local wrappers only (date-picker, nationality-select)
    ↓ import from
hooks/use-[feature].ts                 TanStack Query — ≤200 lines
    ↓ imports from
lib/api/[feature].ts                   network calls only — ≤200 lines
lib/types/[feature].ts                 type definitions — ≤250 lines
lib/schemas/[feature].schema.ts        zod schemas — ≤150 lines
lib/query-keys.ts                      cache keys
lib/utils.ts                           pure utilities
```

**Banned imports:**
- `features/A → features/B` (cross-feature)
- `lib/ → components/` or `lib/ → hooks/`
- `components/ → app/` (reversed layer)

## Design System — Frosted Glass

- iOS-inspired glassmorphism: `backdrop-filter: blur(24px)`, semi-transparent surfaces
- Font: IBM Plex Sans Arabic (RTL-first)
- Spacing grid: 8px
- Tokens: `--primary`, `--surface`, `--border`, `--success`, `--warning`, `--error`
- Dark mode: separate token values via CSS custom properties
- Classes: `.glass`, `.glass-solid`, `.glass-strong` (defined in `globals.css`)
- Token reference: `tokens.md` + `app/globals.css` + `lib/ds.ts`

## Dashboard Routes (app/(dashboard)/)

`activity-log/`, `bookings/`, `branches/`, `branding/`, `categories/`,
`chatbot/`, `clients/`, `contact-messages/`, `content/`, `coupons/`,
`departments/`, `employees/`, `intake-forms/`, `invoices/`,
`notifications/`, `payments/`, `profile/`, `ratings/`, `reports/`,
`services/`, `settings/` (with `billing/` and `sms/` sub-routes),
`users/`

Top-level layout/error/loading: `layout.tsx`, `error.tsx`, `loading.tsx`, `page.tsx`.

## UI Primitive Sourcing

- **Source of truth:** `@sawaa/ui` (`packages/ui/src/primitives/*` + `packages/ui/src/hooks/*`).
  Import as `import { Button } from "@sawaa/ui"`.
- **Never modify primitives in place.** Bug-fix or extend them inside the workspace package.
- **`apps/dashboard/components/ui/`** holds only app-local wrappers
  (currently `date-picker.tsx` and `nationality-select.tsx`). Do NOT
  add new primitives here — they belong in `@sawaa/ui` so mobile/admin
  can share them.
- Two carve-outs intentionally remain (sidebar primitives + a couple of
  app-only components); see `packages/ui/CLAUDE.md` for the list.

## Real-time Updates

- **No WebSockets** — use `refetchInterval` in TanStack Query (30s default for notifications/booking status)
- `socket.io-client` removed 2026-04-12 — revisit only if live queue board or chat dashboard is required
- `@xyflow/react` removed 2026-04-12 — no current use case; re-add when flow diagrams are specced

## i18n + terminology

- **i18n runtime is custom, not next-intl.** The source of truth is
  `components/locale-provider.tsx` (`LocaleProvider` → `useLocale()` →
  `t(key)` backed by a flat `translations[locale][key]` map assembled in
  `lib/translations.ts` from `lib/translations/{ar,en}.*.ts` modules).
  `next-intl` is installed but unused at runtime; do NOT migrate partial
  pages to `useTranslations('<namespace>')` without a deliberate plan —
  it would fork the system.
- **Every user-facing string goes through `t('<key>')`** from `useLocale()`.
  Keys are flat dot-namespaced strings (e.g. `"nav.bookings"`,
  `"bookings.confirmStatus"`). Plurals are currently handled with
  per-case keys (there is no ICU plural helper yet).
- **AR/EN parity is gated** by `npm run i18n:verify` (runs
  `scripts/verify-translation-parity.mjs`). It compares the key set of
  each `ar.*.ts` module against its `en.*.ts` sibling and exits non-zero
  on drift. Run it before every PR that touches translations.
- **`useTerminology` is dead multi-tenant scaffolding — do NOT build on it.** The hook (`hooks/use-terminology.ts`) calls `GET /public/verticals/:slug/terminology`, an endpoint the single-tenant backend never implemented. It is still imported in the employees/clients/bookings pages but stays inert because `verticalSlug` is always undefined (query is `enabled: !!verticalSlug`). Don't pass it a slug, don't extend it. Sawa is single-tenant — use plain `t()` from `useLocale()` for all labels.
- **RTL/LTR direction** is already wired: `LocaleProvider` flips
  `document.documentElement.dir` *and* wraps children in
  `@radix-ui/react-direction`'s `DirectionProvider`. Never hardcode
  `left`/`right`; always use logical Tailwind classes (`ps-`/`pe-`/
  `ms-`/`me-`).
- All dashboard capabilities are available for مركز سواء as a single
  organization. Do not add tenant switching, subscription screens, or
  billing-plan enforcement to the UI.

## Component Placement Rules

| Component type | Location |
|---------------|----------|
| shadcn primitive | `@sawaa/ui` (workspace package) — never modify in place |
| App-local primitive wrapper | `components/ui/` (date-picker, nationality-select only) |
| Feature-specific | `components/features/[feature]/` |
| Shared (3+ features) | `components/features/shared/` or `components/features/[name].tsx` |
| Page layout shells | `components/features/shared/` |
| Sidebar config | `components/sidebar-config.ts` |
| Layout shells | `components/zoho-reconnect-banner.tsx` |

## File Size Limits

| Type | Max lines |
|------|-----------|
| Page (app/) | 150 (add `// EXCEPTION: <reason>, approved <date>` comment if exceeded) |
| Feature component | 300 |
| Hook | 200 |
| API function | 200 |
| Type file | 250 |
| Zod schema | 150 |
| Translation | 300 |
| Any file (absolute) | 350 |

## Pre-PR Checklist

```
□ npm run typecheck          → 0 errors
□ npm run lint               → 0 errors
□ npm run i18n:verify        → AR/EN parity
□ لا يوجد ملف يتجاوز 350 سطر
□ لا cross-feature imports
□ Primitives imported from @sawaa/ui (not components/ui/)
□ كل Query في use-[feature].ts
□ كل Mutation في use-[feature]-mutations.ts
□ page.tsx لا يحتوي على business logic
□ لا hex colors أو text-gray-*
□ كل RTL spacing صحيح (ps-/pe-/ms-/me-)
□ كل أيقونة من @hugeicons فقط
□ لا inline styles
□ staleTime مضبوط على أي query جديدة
□ Feature جديدة مضافة في eslint.config.mjs → FEATURES
□ لا استخدام جديد لـ useTerminology() — single-tenant، النصوص عبر t()
□ لا توجد واجهات tenant switching أو subscription أو billing-plan gating
```

## Development

```bash
npm run dev          # Next.js dev server on :5203 (Turbopack)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest
npm run build        # Production build
npm run i18n:verify  # AR/EN parity gate
```

## QA Gate

**Playwright is the official e2e tool for `apps/dashboard`** (restored 2026-05-04).
Specs live under `apps/dashboard/e2e/` with two project tiers:

| Project | Path | When |
|---------|------|------|
| `smoke` | `e2e/smoke/` | every PR touching `apps/dashboard/**` or `apps/backend/**` |
| `flows` | `e2e/flows/` | nightly cron (02:00 UTC) |

CI: the `.github/workflows/ci.yml` dashboard job runs lint + typecheck + unit tests. Playwright smoke is run locally pre-merge (no dedicated e2e CI workflow exists yet).

```bash
# Local smoke run (requires backend on :5200 + docker stack)
cd apps/dashboard
npm run e2e:smoke

# Full flows
npm run e2e:flows

# Interactive debug
npm run e2e:ui
```

**Chrome DevTools MCP** remains available as a supplemental ad-hoc debugging tool — it is NOT the primary QA gate. Playwright smoke is the required pre-merge check for any page change.

---

## Design Context

### Users
داشبورد إداري لـ **مركز سواء للاستشارات الأسرية** (single-tenant). يخدم ثلاث شخصيات بنِسب متقاربة، فلا قرار تصميم يفضّل واحدة على حساب الباقي:
- **موظفة استقبال** — تستخدمه طول الدوام على شاشة مكتب. عمليات سريعة ومتكررة (حجوزات، دفع، تواصل). تحتاج كثافة معلومات معقولة + سرعة وصول.
- **استشاريون / أخصائيون** — يفتحونه بين الجلسات لمراجعة ملفات العملاء والملاحظات. يحتاجون قراءة هادئة وتركيز على الكلاينت.
- **مدير العيادة** — يفتحه أوقات متفرقة للتقارير والإيرادات. يحتاج نظرة شاملة وأرقاماً واضحة.

السياق: شاشات مكتبية وأحياناً تابلت، نهاراً غالباً، تحت إضاءة عيادة. عربي RTL أولاً.

### Brand Personality
- **ثلاث كلمات**: دافي، هادئ، احترافي (warm، calm، professional).
- **الإحساس**: warm-human — منصة لعلاقات إنسانية، فيها دفء واحترام لحساسية الاستشارة الأسرية، بدون أن تبدو طبية باردة أو إدارية جافة.
- **النبرة**: ثقة هادئة. كلام مباشر بأدب. لا hype، لا تعجّب، لا emojis في النصوص الإدارية.

### Aesthetic Direction
**الاتجاه**: Soft contemporary بنكهة عربية احترامية. روح Stripe في الدقة والتفاصيل، مع دفء Apple Health في التعامل مع البيانات الحساسة. الـ frosted glass الموجود يبقى لكن يُستخدم **بانتقاء** (سايدبار، popovers، overlays)، لا يُلصق على كل سطح.

**الثيم**: الاثنين، مع تفضيل الفاتح كافتراضي.

**Anti-references**:
- شكل الداشبورد الإداري العربي العادي (جداول مكتظة، badges صارخة، admin panel feel).
- Glassmorphism في كل مكان — blur عشوائي يضرّ القراءة.
- AI dashboard 2024-2025: cyan-on-dark، neon gradients، sparklines زخرفية، gradient text، border-left ملوّن على البطاقات.
- Material Design المبالغ: drop shadows ثقيلة، FABs.

**References**: Stripe Dashboard (typography، rafhah الجداول، lون نادر قوي)، Apple Health (دفء طبي، تعامل إنساني مع بيانات حساسة).

### Design Principles

1. **الكلاينت قبل الـ chrome.** المعلومة عن الإنسان هي البطلة. قلّل البوردرات والبادجات، خلّ المسافة تشتغل.
2. **دفء بالألوان، هدوء بالشكل.** ألوان البراند في الـ 10% فقط (60-30-10). السطوح نُيوترال دافي tinted toward brand hue بـ chroma خفيف. لا pure gray ولا neon.
3. **إيقاع، لا تكرار.** مسافات تتنفّس: مجموعات قريبة، فواصل سخية. تفادَ صفوف بطاقات متطابقة. اكسر الشبكة عمداً للعنصر الذي يستحق تركيزاً.
4. **الزجاج وظيفي، ليس زينة.** glass للسايدبار/popovers/overlays فقط. الـ inline cards وdata tables تستخدم `--surface-solid` بحدود ناعمة وshadow-sm.
5. **RTL بضمير.** padding/margin منطقي، أرقام `tabular-nums`، أيقونات الاتجاه تنعكس. غير قابل للتفاوض.
6. **الحركة تخدم الحالة.** ease-out exponential، 150-250ms، عبر `motion` library. لا bounce، لا elastic، لا زينة. احترم `prefers-reduced-motion`.

**Tokens reference**: `tokens.md` + `app/globals.css` + `lib/ds.ts`. كل لون/مسافة/radius من هناك، لا hardcode.
