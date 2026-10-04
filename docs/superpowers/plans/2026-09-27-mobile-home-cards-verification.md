# Mobile home cards — local implementation and review

Date: 2026-09-27 (Asia/Riyadh). Base: `0647f6273`; branch: `codex/clinic-catalog-unification`.
Worktree: `/Users/tariq/.codex/worktrees/clinic-catalog-unification/sawaa`.

The owner approved the design and explicitly requested Luna implementation with Astra review. Three GPT-6 Luna high workers owned backend, dashboard, and mobile separately; Astra fixed the contract, reviewed the actual source, requested corrections, generated contracts, and ran integrated verification. The owner subsequently requested a local commit. No push, merge, staging, or production deployment was performed.

## Delivered

- Dedicated `MobileHomeCard` model, additive migration, staff list/create/update/reorder and public published-card APIs.
- Existing Setting read/update permissions. Public projection omits internal file/publication/version fields. Only live PUBLIC image files are signed; signing failure retains card text.
- Conditional versioned updates and atomic Serializable reorder through the existing single-tenant transaction wrapper. Stale or competing writes return 409.
- Dashboard Settings → كروت التطبيق: bilingual editor, optional public image, image removal, visibility, fixed destinations and ordering. Dirty edits survive save/refetch errors; conflict requires explicit reload.
- Shared guest/client mobile home: one full-width Glass card above the greeting, cover image with a light overlay, Arabic/English fallback, safe internal navigation and pull-to-refresh. Horizontal swipes replace the whole card with a short fade/slide; accessible pagination dots select a card. Empty/error responses do not block home. Cards opt into silent query errors without suppressing other query errors.
- OpenAPI snapshot and generated dashboard types updated. Existing API-client package does not consume these endpoints.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Mobile full Jest | 117 suites, 708 passed | `/tmp/sawaa-home-cards-mobile-tests.log` |
| Backend card DTO/handler/controller + module wiring | 5 suites, 21 passed (19 + 2 after final wrapper correction) | `/tmp/sawaa-home-cards-backend-tests-final.log`, `/tmp/sawaa-home-cards-backend-wiring-final.log` |
| Dashboard focused Vitest | 2 files, 9 passed | `/tmp/sawaa-home-cards-dashboard-tests-final.log` |
| Dashboard Playwright smoke | 41 passed, 1 skipped | `/tmp/sawaa-home-cards-smoke.log` |
| Backend build | Passed | `/tmp/sawaa-home-cards-backend-build-final.log` |
| Mobile/dashboard types | Passed | `/tmp/sawaa-home-cards-mobile-types.log`, `/tmp/sawaa-home-cards-dashboard-types-final.log` |
| Scoped ESLint (three apps) | Passed, no output | `/tmp/sawaa-home-cards-{backend,dashboard,mobile}-lint-final.log` |
| Dashboard AR/EN key parity | Passed | `/tmp/sawaa-home-cards-translations.log` |
| OpenAPI generation/semantic comparison | 4 added paths, 6 added schemas; every existing path/schema unchanged | `pnpm openapi:sync` against localhost:55200, checked against HEAD |
| Diff whitespace | Passed | `git diff --check` |
| Final visual and CSP corrections | 19 mobile tests, 10 dashboard tests; mobile/dashboard types and scoped lint passed | `/tmp/sawaa-home-cards-motion-{tests,types,lint}.log`, `/tmp/sawaa-home-cards-preview-{tests,types,lint}.log` |

Focused final commands:

```sh
# apps/backend
pnpm exec jest src/modules/org-experience/mobile-home-cards src/api/dashboard/mobile-home-cards.controller.spec.ts --runInBand
pnpm exec jest src/api/public/public.module.spec.ts src/modules/org-experience/org-experience.module.spec.ts --runInBand
pnpm build
# apps/dashboard
pnpm exec vitest run test/unit/features/settings/mobile-home-cards-tab.spec.tsx test/unit/lib/mobile-home-cards-api.spec.ts --pool=forks --maxWorkers=1
pnpm typecheck
PW_API_URL=http://localhost:55200 pnpm exec playwright test --project=smoke
# apps/mobile (not root workspace commands)
pnpm test -- --runInBand
pnpm typecheck
```

The first smoke attempt reproduced login HTTP 429. The completed smoke used the existing `THROTTLER_DISABLED=true` test switch only on the isolated local API. No auth/rate-limit source was changed. The API was then rebuilt and restarted without the flag. Final real-HTTP concurrency checks passed against this normal runtime: stale PATCH 409, concurrent saves exactly 200/409, atomic reorder, stale reorder 409; original fixture content/order restored. See `/tmp/sawaa-home-cards-transactions-final.log`.

## Runtime and visual evidence

Dedicated QA infrastructure: Postgres localhost:55461 database `sawaa_clinic_qa`, Redis56391, MinIO59011. A pre-migration dump is `/tmp/sawaa-home-cards-qa-before.dump`. Only the new migration was applied to this local QA database. Three test cards remain for review.

Browser localhost:5203: normal admin login, create card, image upload, publish and reorder exercised. HTTP tests additionally covered draft filtering, required input rejection, public projection, hide/republish, stale and concurrent mutations. No production credentials/data were used.

iPhone 17 Pro simulator, iOS26.5, installed `sa.sawa.app`, loaded this worktree through Metro8083 with API55200. Existing Metro8082 was preserved. Screenshot confirms the same admin-created image/title/description above the greeting. Arabic light and dark with accessibility-extra-large text were viewed; text and image remained visible. Simulator appearance/text size restored to light/large afterward. Guest specialist navigation was exercised.

- [Mobile Arabic/light](/Users/tariq/.codex/visualizations/2026/09/26/01a0dfa5-a688-7700-abed-dd116bc91244/mobile-home-cards-ar.jpg)
- [Mobile dark/large text](/Users/tariq/.codex/visualizations/2026/09/26/01a0dfa5-a688-7700-abed-dd116bc91244/mobile-home-cards-dark-large.jpg)
- [Admin settings](/Users/tariq/.codex/visualizations/2026/09/26/01a0dfa5-a688-7700-abed-dd116bc91244/mobile-home-cards-admin.png)
- [Final single-card mobile layout](/Users/tariq/.codex/visualizations/2026/09/26/01a0dfa5-a688-7700-abed-dd116bc91244/home-cards-single-final.jpg)
- [Final card motion](/Users/tariq/.codex/visualizations/2026/09/26/01a0dfa5-a688-7700-abed-dd116bc91244/home-cards-motion-preview.mp4)
- [Admin image visible after CSP correction](/Users/tariq/.codex/visualizations/2026/09/26/01a0dfa5-a688-7700-abed-dd116bc91244/home-cards-admin-images-fixed.png)

## Remaining acceptance boundaries

- The admin image preview now loads from local MinIO in development (`naturalWidth=1672` observed in the browser). Production's strict CSP remains unchanged. HTTPS production media preview has not been verified.
- Arabic right and left swipes were manually verified on the iOS26.5 simulator. English and signed-in-client visual review, physical devices and iOS27 remain unverified. Component tests cover locale direction, fallback, routes, empty/single/multiple cards, image error, pagination, reduced motion and silent/cache query behavior. These tests do not replace those visual checks.
- Browser smoke ran before the last narrow cached-refetch/pending-save UI fix and wrapper refactor; those corrections have fresh focused tests, types, lint, build and real-HTTP transaction evidence. No full-suite rerun was warranted by unchanged contracts.
- This is local implementation evidence, not release or production acceptance.

Usage receipt records all four participants under `/Users/tariq/.codex/routing-review/mobile-home-cards-receipts`. Baselines were late, so full-task token cost remains unknown; no savings claim.
