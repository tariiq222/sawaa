# Sawa Website — Next.js Public Site

Public marketing + booking site for مركز سواء. Where clients browse therapists, read content, and book/pay for sessions.

## Tech

Next.js 15 (App Router), React 19, TanStack Query v5, Tailwind 4, TypeScript strict. Sentry/GlitchTip for error tracking. **No form library** — forms are vanilla React (`useState` + `FormEvent`); validation is custom (`features/*/`*.schema.ts`). Package name is `@sawaa/website` (npm scope inherited from the fork — do not rename).

Does **not** consume `@sawaa/ui`. The website builds its own bespoke themed components under `themes/`. It depends only on `@sawaa/shared` (types/tokens) and `@sawaa/api-client`.

## Commands (from `apps/website/`)

```bash
npm run dev          # next dev on :5205
npm run build        # production build (output: standalone)
npm run start        # next start on :5205
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run test:watch   # vitest watch
```

## Architecture: feature folders + pluggable themes

```
app/                       ← App Router routes (thin — fetch + delegate to theme page)
features/<feature>/        ← feature modules: <feature>.api.ts + components + schemas
  ├── auth/                login/register/forgot/reset, auth-store.ts, auth-guard.tsx
  ├── branding/            PublicBranding fetch + provider + CSS-var injection
  ├── booking/  payment/  therapists/  public-catalog/
  ├── support-groups/  site-content/  contact/  otp/  burnout-test/
  └── locale/              custom AR/EN i18n (locale-provider.tsx, useT, useLocale)
themes/                    ← single theme for the website
  ├── registry.ts          exports the single `theme` object (Layout + Pages)
  └── sawaa/               SAWAA theme (layout/ + pages/)
lib/                       api-base.ts, public-fetch.ts, money.ts, seo/
hooks/use-public-query.ts  TanStack Query wrapper
providers/query-provider.tsx
```

### Single theme (SAWAA)

The website uses a single fixed theme under `themes/sawaa/`. `themes/registry.ts` exports a single `theme` object (Layout + per-route Pages). Each `app/<route>/page.tsx` is thin: it imports `theme` directly from `@/themes/registry` and renders the theme's page component.

## API integration

- **`@sawaa/api-client`** is the typed client. Each `features/<feature>/<feature>.api.ts` wraps client methods (often re-exporting under historical names).
- `lib/public-fetch.ts` — raw fetch helper: auto-prefixes `/api/v1`, throws `PublicFetchError(status, body)` on non-2xx.
- `lib/api-base.ts` — base URL = `INTERNAL_API_URL ?? NEXT_PUBLIC_API_URL ?? http://localhost:5200`, then `+ /api/v1`. `NEXT_PUBLIC_API_URL` is validated at build time.

## Client auth (httpOnly cookie)

Website client auth is fully separate from dashboard admin JWT (see `apps/backend/CLAUDE.md` → Client Auth). The session lives in an **httpOnly cookie** — the browser sends it automatically; all auth API calls use `credentials: 'include'`. There is no token in JS. `features/auth/auth-store.ts` holds only the client *profile* (not the token); `auth-guard.tsx` gates `/account/*` routes client-side.

Auth routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`. Protected: `/account`, `/account/bookings`, `/account/bookings/[id]`.

## i18n

Custom AR/EN — **not** next-intl. `features/locale/`: `getLocale()` reads the `sawaa-locale` cookie (default `ar`), `localeDir()` → `rtl`/`ltr`. `LocaleProvider` exposes `useLocale()` and `useT()`. Root layout sets `<html lang dir>`. Page metadata carries both AR + EN titles/descriptions.

## Conventions

- App Router pages stay thin — fetch + delegate to a theme page component.
- Every user-facing string goes through `useT()`. No hardcoded brand colors — use CSS vars from `PublicBranding`.
- New API calls go in a `features/<feature>/<feature>.api.ts`, not inline in components.
- Tests are Vitest + Testing Library (jsdom). No Playwright e2e here.
- `output: 'standalone'` + `outputFileTracingRoot` set for Docker; workspace packages are transpiled.
