# Sawa Mobile — Expo React Native

## Tech

React Native 0.83, Expo SDK 55, Expo Router (file-based), Redux Toolkit + redux-persist (auth only), TanStack Query v5 (all server data), Axios, i18next (AR/EN), React Hook Form + Zod, Expo Notifications (FCM), Zoom Meeting SDK (via JoinVideoCallButton).

## App Structure

```
app/
├── (auth)/                # Login, registration, OTP
├── (client)/              # Client-facing flows
│   ├── (tabs)/            # Bottom tab navigator (home, bookings, chat, profile)
│   ├── appointment/       # Appointment detail, history
│   ├── booking/           # Book appointment flow (slots → invoice → Moyasar)
│   ├── clinic/            # Clinic info / branches
│   ├── employee/          # Employee profile (client-side view)
│   ├── rate/              # Rating flow
│   ├── chat.tsx           # Chatbot screen
│   ├── therapists.tsx     # Therapist directory
│   ├── settings.tsx       # Settings (theme, language, notifications)
│   ├── settings-profile-section.tsx
│   └── video-call.tsx     # Zoom join — window [start-15m, end]
└── (employee)/            # Employee-facing flows
    ├── (tabs)/            # Bottom tab navigator
    ├── appointment/       # Manage appointments
    ├── client/            # Client profile view
    ├── availability.tsx   # Employee availability scheduler
    └── video-call.tsx     # Zoom host join
```

## Conventions

- **Routing**: Expo Router file-based — `_layout.tsx` defines navigators; client and employee groups are strictly separated.
- **State**:
  - **Redux Toolkit is for `auth` only** (token + refreshToken + user, persisted via `redux-persist` to Expo Secure Store). No new slices without explicit discussion.
  - **All server data → TanStack Query v5** in `hooks/queries/` (one hook per resource, exported through `hooks/queries/index.ts`).
  - Transient UI state (modals, form drafts, typing indicators) → component-level `useState`/`useReducer`.
- **API**: Axios services in `services/` — one file per domain; `services/client/` and `services/employee/` hold role-specific endpoints.
- **i18n**: `i18next` + `react-i18next` — translation files in `i18n/`; keys mirror dashboard/backend tokens.
- **Theme**: Branding tokens consumed from backend `PublicBranding` via the theme slice; never hardcode brand colors.
- **Components**: Reusable in `components/`, feature-specific stay in `app/`.

## Service Files (`services/`)

Top-level: `api.ts` (base Axios + interceptors), `auth.ts`, `branches.ts`, `chatbot.ts`, `clients.ts`, `employees.ts`, `notifications.ts`, `payments.ts`, `push.ts`, `query-client.ts`.

Subdirectories: `services/client/` (client-only endpoints), `services/employee/` (employee-only endpoints).

## Query Hooks (`hooks/queries/`)

`useBooking`, `useBookingMutations`, `useBranding`, `useChat`, `useClientBookings`, `useEmployeeClients`, `useEmployeeDayBookings`, `useMe`, `useMobileAuth`, `useNotifications`, `usePortal`, `useSlots`, `useTherapist`, `useTherapists`, `useUpcomingBookings` — re-exported via `hooks/queries/index.ts`.

## Deployment Strategy — One App Instance

**Read the "Operational safety rules" section in [../../CLAUDE.md](../../CLAUDE.md) / [../../AGENTS.md](../../AGENTS.md) first** — they are binding here too.

`apps/mobile/` is **single-tenant by design**. Every published build is locked to exactly one Sawa deployment.

- **Current build:** `سواء للإرشاد الأسري` (Sawa) — bundle `sa.sawa.app`, vertical `family-consulting`. See `app.config.ts`.
- **Request context:** Mobile sends only auth credentials. It must not send a legacy organization-selection header; the backend stamps the fixed single-tenant context from the authenticated session.
- **No runtime organization switching.** Do not add an organization switcher, multi-org membership UI, or terminology hot-swap to mobile.
- **Membership/organization-switch scaffolding has been removed.** The memberships service, the org-id (tenant) service, the memberships query hook, and the auth slice's organization/membership fields were deleted in the single-tenant cleanup. The backend has no `/auth/memberships` endpoint. Do not reintroduce them.
- **Branding** is still fetched at runtime via `PublicBranding` — for this deployment only. `useTerminology()` was deleted along with the endpoint it called (`/public/verticals/:slug/terminology` no longer exists on the backend). Switching organizations is not a user-facing operation.

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
- Theme slice (Redux) consumes the result and exposes tokens to RN components.
- All colors, logo, and typography flow from this — no hardcoded brand values anywhere.

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
