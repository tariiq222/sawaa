# Sawa Mobile — Expo React Native

## Tech

React Native 0.83, Expo SDK 55, Expo Router (file-based), Redux Toolkit + redux-persist (auth only), TanStack Query v5 (all server data), Axios, i18next (AR/EN), React Hook Form + Zod, Expo Notifications (FCM), Zoom Meeting SDK (via JoinVideoCallButton).

## App Structure

```
app/
├── (auth)/                # Login, registration, OTP
├── (client)/              # Client-facing flows
│   ├── (tabs)/            # home, explore, appointments, account
│   ├── appointment/       # Client appointment detail
│   ├── booking/           # Schedule, confirm, invoice, payment callbacks
│   ├── clinic/            # Clinic info and branches
│   ├── employee/          # Employee profile as seen by clients
│   ├── groups/            # Group-session discovery and enrollment
│   ├── packages/          # Package purchase, balance, and booking
│   ├── rate/              # Rating flow
│   ├── therapists.tsx     # Therapist directory
│   ├── chat.tsx           # Client chat surface
│   ├── settings*.tsx      # Profile, language, theme, notifications
│   └── video-call.tsx     # Client Zoom join
└── (employee)/            # Employee-facing flows
    ├── (tabs)/            # today, calendar, clients, profile
    ├── appointment/       # Manage appointment
    ├── client/            # Client profile and history
    ├── availability.tsx   # Employee availability scheduler
    └── video-call.tsx     # Zoom host join
```

## Conventions

- **Routing**: Expo Router file-based — `_layout.tsx` defines navigators; client and employee groups are strictly separated.
- **State**:
  - **Redux Toolkit is for `auth` only** (token + refreshToken + user, persisted via `redux-persist` to Expo Secure Store). No new slices without explicit discussion.
  - **Server reads → TanStack Query v5** in `hooks/queries/` (one hook per resource, exported through `hooks/queries/index.ts`). Use mutation hooks for writes that update shared server state so cache invalidation stays out of route screens; keep form drafts and transient UI state local.
  - Transient UI state (modals, form drafts, typing indicators) → component-level `useState`/`useReducer`.
- **API**: Axios services in `services/` — one file per domain; `services/client/` and `services/employee/` hold role-specific endpoints.
- **i18n**: `i18next` + `react-i18next` — translation files in `i18n/`; keys mirror dashboard/backend tokens.
- **Theme**: `ThemeProvider` accepts backend `PublicBranding` for compatibility and combines the system/user color scheme with the fixed Sawaa design tokens. `buildTheme` retains the Sawaa palette; branding does not override theme colors. The selected theme mode is stored in AsyncStorage; theme state is not in Redux. Never hardcode brand colors.
- **Components**: Reusable in `components/`, feature-specific stay in `app/`.

## Service Files (`services/`)

Top-level: `api.ts` (base Axios + interceptors), `auth.ts`, `branches.ts`, `clients.ts`, `employees.ts`, `notifications.ts`, `payments.ts`, `push.ts`, `query-client.ts`.

Subdirectories: `services/client/` (client-only endpoints), `services/employee/` (employee-only endpoints).

## Query Hooks (`hooks/queries/`)

The query index is the public entry point for resource hooks; inspect `hooks/queries/index.ts` for the live inventory. Route components should consume those hooks rather than call service read methods directly.

## Deployment Strategy — One App Instance

**Read the "Operational safety rules" section in [../../CLAUDE.md](../../CLAUDE.md) / [../../AGENTS.md](../../AGENTS.md) first** — they are binding here too.

`apps/mobile/` is **single-tenant by design**. Every published build is locked to exactly one Sawa deployment.

- **Current build:** `سواء للإرشاد الأسري` (Sawa) — bundle `sa.sawa.app`, vertical `family-consulting`. See `app.config.ts`.
- **Request context:** Mobile sends only auth credentials. It must not send a legacy organization-selection header; the backend stamps the fixed single-tenant context from the authenticated session.
- **No runtime organization switching.** Do not add an organization switcher, multi-org membership UI, or terminology hot-swap to mobile.
- **Membership/organization-switch scaffolding has been removed.** The memberships service, the org-id (tenant) service, the memberships query hook, and the auth slice's organization/membership fields were deleted in the single-tenant cleanup. The backend has no `/auth/memberships` endpoint. Do not reintroduce them.
- **Branding** is fetched at runtime via `PublicBranding` — for this deployment only. `useTerminology()` was deleted along with the endpoint it called (`/public/verticals/:slug/terminology` no longer exists on the backend). Switching organizations is not a user-facing operation.

### Adding a New Branded App

A second branded deployment means a **new build**, not a runtime mode:

1. Fork `apps/mobile/` (or branch + variant config).
2. Replace `app.config.ts` (`name`, `slug`, `scheme`, `bundleIdentifier`, `package`, `icon`).
3. Drop new assets under `assets/<slug>/`.
4. Update app-scoped public configuration in `constants/config.ts`.
5. Publish under the new bundle ID on App Store / Play Store.

Backend, dashboard, and admin do not change.

## Branding

- `useBranding` query fetches `PublicBranding` for the Sawa deployment.
- `ThemeProvider` consumes the result and exposes theme colors and mode to RN components.
- UI colors and typography come from the fixed Sawaa tokens and locale font aliases. PublicBranding does not replace the palette in `buildTheme`; preserve that behavior. Logos retain their existing asset/branding consumers. No hardcoded brand values in components.

## Terminology

- `hooks/useTerminology.ts` **no longer exists** (deleted with the rest of the multi-tenant scaffolding; verified 2026-09-21). The backend exposes no `/public/verticals/:slug/terminology` endpoint.
- Do not recreate it and do not add a replacement: use plain i18n keys for every new screen.

## Push Notifications (FCM)

- `services/push.ts` registers the Expo push token with the backend, handles permission prompts, and routes incoming notifications.
- Deep-links: notification payloads carry a route — tapping navigates into the relevant screen (appointment, chat, invoice).
- Mark-read flow + unread-count badge driven by `useNotifications`.
- Tests in `services/__tests__/push.test.ts`.

## Video Calls (Zoom)

- `JoinVideoCallButton` component encapsulates eligibility logic.
- Join window: `[appointment.start - 15min, appointment.end]` — button is disabled outside that window.
- Two screens: `app/(client)/video-call.tsx` (attendee) and `app/(employee)/video-call.tsx` (host).
- Backend issues short-lived Zoom JWT/SDK signatures; never store Zoom secrets on device.

## Key Rules

- No `any` in TypeScript
- No hardcoded strings — use i18n keys (there is no `useTerminology`; vertical-sensitive terminology was removed with the multi-tenant scaffolding)
- No hardcoded colors — **STRICT: No hex colors (#...) or ad-hoc RGBA in components.** Use `sawaaTokens` or `sawaaColors` from `theme/sawaa/tokens.ts`, or the shared re-exports in `theme/tokens.ts`.
- **Deprecated: `theme/glass.ts` has been deleted.** Use the unified Sawaa design system (`theme/sawaa/`).
- 350-line max per file
- Client and Employee routes must stay strictly separated
- Expo Secure Store for sensitive data (tokens), AsyncStorage for non-sensitive preferences
- Authenticated requests carry only the JWT; the backend derives deployment context from the session — never send an organization header

## Development

```bash
npm run dev           # Expo start (Metro bundler)
npm run ios           # iOS simulator
npm run android       # Android emulator
npm run test          # Jest + jest-expo
```

## Mobile change and release record

Before closing any mobile app change (screen, component, behavior, content, configuration, or store build), update the dated entry under [`../../docs/mobile-app/releases/`](../../docs/mobile-app/releases/) with the exact change, Git state, checks, environment, build/delivery IDs when applicable, and unverified device flows. Follow and update the [mobile release runbook](../../docs/mobile-app/runbook.md) whenever the build or TestFlight sequence changes. Keep [`../../docs/mobile-app/README.md`](../../docs/mobile-app/README.md) aligned with the latest observed status. This documentation work does not authorize a commit, push, backend deployment, or App Review submission. Never copy credentials or customer data into these files.


## Clinic discovery and booking context

[Canonical clinic/service contract](../../docs/architecture/clinic-service-booking-contract.md)

Use @sawaa/shared/catalog for clinic selection, opt in to direct clinics for catalog/list/detail reads, and preserve clinicId/serviceId through practitioner navigation. Missing scoped data must not silently broaden the service list. Never infer clinics from department names.
