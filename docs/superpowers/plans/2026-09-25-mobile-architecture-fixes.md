# Mobile Architecture Fixes Implementation Plan

> **For agentic workers:** Implement inline in the current checkout and preserve all existing local changes.

**Goal:** Align the mobile app's architecture documentation and implementation, consolidate the identified server-read paths under TanStack Query, and bring the three files above the documented 350-line limit below it without behavior changes.

**Architecture:** Keep Expo Router route ownership and existing service APIs. Add focused query hooks for screen reads that currently bypass shared query state; retain screen-specific orchestration and mutation services. Extract cohesive presentation or formatting units from oversized files, and update the mobile architecture guide from current source evidence.

**Tech Stack:** Expo SDK 55, React Native 0.83, Expo Router, TanStack Query v5, TypeScript, Jest/jest-expo.

**Spec:** User's request to complete the fixes from the mobile architecture review; `apps/mobile/CLAUDE.md` is the governing mobile convention document.

## Global Constraints

- Preserve the user's dirty working tree and do not overwrite their mobile glass/accessibility edits.
- Client and employee route groups stay separate.
- Redux remains auth-only; server state belongs in TanStack Query.
- Keep the app single-tenant; do not add organization or terminology switching.
- Do not modify auth guards, payment behavior, or Moyasar flows.
- Tests were explicitly authorized by the user on 2026-09-25; keep verification scoped to the affected mobile suites.
- Do not commit, push, merge, deploy, or clean branches.

## Review Focus

- Query cache keys must include every parameter that changes a server response.
- Read-hook conversions must preserve loading, error, retry, and refresh behavior.
- Employee-specific query hooks must stay inside employee route access boundaries.
- Extracted view components must preserve accessibility props and touch behavior, including the user's in-progress Glass changes.
- Documentation must match route names, tab composition, theme persistence, and state ownership in current source.

### Task 1: Reconcile the mobile architecture guide

**Files:**
- Modify: `apps/mobile/CLAUDE.md`

- [x] Read actual route, Redux, query, theme, and config sources.
- [x] Update the route tree and tab names to match current Expo Router files.
- [x] Correct theme/state statements; explicitly describe auth-only Redux, Query server state, and AsyncStorage theme preference.
- [x] Remove stale query-hook/service inventory entries and preserve single-tenant, security, deployment, and package constraints.
- [x] Review the edited guide against source line-by-line.

### Task 2: Consolidate the identified server reads

**Files:**
- Create or modify focused modules under `apps/mobile/hooks/queries/` for public catalog departments and employee booking detail where no reusable query exists.
- Modify: `apps/mobile/app/(client)/booking/confirm.tsx`
- Modify: `apps/mobile/app/(client)/booking/success.tsx`
- Modify: `apps/mobile/app/(employee)/(tabs)/today.tsx`
- Modify: `apps/mobile/app/(employee)/appointment/[id].tsx`
- Modify: `apps/mobile/components/features/VideoCallScreen.tsx`
- Modify: `apps/mobile/hooks/queries/index.ts`

- [x] Define typed, parameter-complete query keys and disabled behavior for missing route ids.
- [x] Replace the service-listing effect in booking confirmation with a shared catalog query.
- [x] Replace the employee profile's inline `useQuery` call with the shared public catalog hook.
- [x] Replace the success screen's ad-hoc booking read with the existing booking query.
- [x] Replace employee today/detail reads with shared employee booking queries while retaining existing service mutations.
- [x] Use role-specific client/employee detail hooks in the video-call component and ensure inactive-role requests stay disabled.
- [x] Add mutation hooks for employee booking actions and invalidate employee booking lists/details after successful writes.
- [x] Inspect query invalidation, refresh, error presentation, and user-local changes around each converted screen.
- [x] Review service callsites to confirm only the identified reads moved; payment and auth paths remain untouched.

### Task 3: Split oversized source files by responsibility

**Files:**
- Modify: `apps/mobile/app/(client)/booking/confirm.tsx`
- Create: focused booking confirmation summary/formatting module under `apps/mobile/components/features/booking/`
- Modify: `apps/mobile/theme/components/Glass.tsx`
- Create: focused glass layer-rendering module under `apps/mobile/theme/components/`
- Modify: `apps/mobile/app/(client)/(tabs)/appointments.tsx`
- Create: focused appointment presentation/helper module under `apps/mobile/components/features/`

- [x] Keep booking confirmation under 350 lines after its data-read conversion; extract more only if the measured file still exceeds the limit.
- [x] Extract rendering layers from Glass while preserving the user's current component API, accessibility props, and animation/contrast fallback behavior.
- [x] Extract appointment styles from the tab screen while keeping query ownership and navigation in the route.
- [x] Count final source lines and ensure each target source file is at most 350 lines.
- [x] Review all changed files and `git diff` to verify there are no unrelated edits.

## Completion Evidence

- `pnpm --dir apps/mobile exec jest --runInBand --runTestsByPath ...` — 18 suites passed, 179 tests passed. Existing React `act(...)` warnings remain in `today-load-failure.test.tsx`, `useBookings.test.ts`, and `rate-booking-real-data.test.tsx`; no test failures.
- `pnpm --dir apps/mobile typecheck` — passed.
- Focused ESLint on changed mobile source and test files — passed with no warnings after stabilizing `bookings` and `statusConfig` in the appointments tab.
- `git diff --check` — passed.
- Source line counts: booking confirm 342; Glass 249; appointments tab 286.
- Moved route helpers out of `app/` into feature/component modules; a fresh Metro bundle emitted no Expo Router missing-default-export warnings.
- iOS 26.5 iPhone 17 Pro: Xcode Debug build exited 0; `simctl install` and `simctl launch` succeeded; screenshot confirms the login screen renders. The screen shows `Network Error`; authenticated/backend-dependent flows were not verified.
