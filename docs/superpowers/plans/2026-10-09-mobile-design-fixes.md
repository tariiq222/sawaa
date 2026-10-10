# Mobile design fixes implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. No product flow changes.

**Goal:** Fix the six confirmed mobile presentation defects from the physical-device audit.

**Architecture:** Fix reusable presentation components and translated copy. Resolve selected service display from the existing public catalog without changing filtering, navigation, booking steps, payment state or backend behavior.

**Tech Stack:** Expo 55, React Native 0.83, TanStack Query, i18next, Jest/RNTL.

**Spec:** /Users/tariq/.codex/reports/sawaa-mobile-design-20261009/تقرير-تصميم-الجوال.md (F01/F02/F03/F04/F08/F09), narrowed by the owner's latest instruction to design only.

## Global constraints

- Preserve payment session changes at base 4c0189aeef72e3b9a62951b60259a1a8e3861759.
- Work in the attached mobile-design-fixes worktree; preserve all unrelated work.
- No backend, booking lifecycle, payment guard, date, balance or navigation changes.
- Use existing theme roles and translation keys. Never expose hidden DIRECT service copy.
- The owner subsequently authorized a local commit of this session's work only. No push, merge, deployment or TestFlight upload is authorized.

## Review focus

- Failed photo, URI change and late callbacks: new photos remain eligible to load.
- Identical and distinct specialty/title fields in Arabic and English: remove only duplicates.
- Both appearances: destructive text/icon contrast remains readable.
- SERVICES, DIRECT, missing/invalid catalog and long localized service names: show only valid visible context.
- Native alerts: localized dismiss button without changing callbacks or payment eligibility.

## Task 1: Photos and practitioner subtitle

Files: components/ui/Thumb.tsx and its existing redesign-primitives.test.tsx; components/features/directory/TherapistCard.tsx and directory.test.tsx.

- [x] Add failing tests: after Image error, no broken Image and a User glyph; changing URI retries; stale error cannot hide the new Image. Subtitle equal after whitespace normalization appears once; distinct fields retain both.
- [x] Run `pnpm --dir apps/mobile exec jest --runInBand --coverage=false redesign-primitives directory.test` and observe failures.
- [x] Store the failed URI in Thumb, reset on URI change, preserve caller onError, and key the Image by URI. Normalize/trim/filter unique subtitle strings.
- [x] Run the focused tests and record results.

## Task 2: Destructive contrast

Files: components/ui/MenuGroup.tsx, ConfirmSheet.tsx, new destructive-presentation.test.tsx.

- [x] Test real rendered danger label and icon colors against their backgrounds in light/dark (text >=4.5:1, icon >=3:1 including the tinted circle).
- [x] Observe failures, use `getSawaaRoles(scheme).danger.fill` for presentation, preserving non-danger and button behavior.
- [x] Run the focused tests.

## Task 3: Selected service context and filter copy

Files: app/(client)/therapists.tsx and therapists-directory-errors.test.tsx; i18n/ar.json and en.json.

- [x] Add route render tests: visible service name in Arabic/English, step progress unchanged, DIRECT internal name absent, invalid service/category absent, fallback locale and multiline layout.
- [x] Observe failures; call `usePublicCatalog(Boolean(serviceId))`, resolve with `getCategoryBookingServices`, display valid non-hidden service name below the existing header. Do not alter route effects or list filtering.
- [x] Replace comparison-symbol price chip copy with `أقل من ٣٠٠ ر.س` / `Under 300 SAR`; existing price boundary tests remain the acceptance for filtering.
- [x] Run directory/filter tests and types.

## Task 4: Localized native dismiss labels

Files: features/booking/booking-payment-error.ts; use-booking-payment.ts; existing use-booking-payment.test.tsx.

- [x] Extend existing alert assertions to require localized common.ok on the generic and existing-online-invoice alerts. Keep all lifecycle tests.
- [x] Observe failures; add only explicit `{ text: t('common.ok') }` buttons to the three default-button alert calls.
- [x] Run hook tests. Before final review inspect the other session again and record overlap as presentation-only hunks.

## Task 5: Verification and handoff

- [x] Run the relevant integrated tests, mobile typecheck and lint; broaden only for unresolved concerns.
- [x] Fresh reviewer checks the actual uncommitted diff, especially scope and late Image callbacks.
- [x] Save a dated release record with exact Git state, checks and unverified physical-device status. Update the mobile index in this isolated worktree.
- [x] Preserve work without integration; report fixes and fresh evidence, leaving flow ownership to the other session.
