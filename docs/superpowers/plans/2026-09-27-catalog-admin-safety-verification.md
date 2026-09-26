# Catalog administration safety — verification

Date: 2026-09-27 (Asia/Riyadh). The owner approved implementation and explicitly requested a Luna team.

## Delivery

- Workspace: `/Users/tariq/.codex/worktrees/catalog-admin-safety/sawaa`.
- Branch: `codex/catalog-admin-safety`; base: `0647f627334c6de5ce4c4441b796de5eb29a1b08`.
- Changes are local and uncommitted. No push, merge, staging/production deployment, or production data change.
- No schema migration was added or modified. Existing category, service, department, practitioner and entitlement IDs retain their meaning.

## Result

1. Service creation asks for one clinic/service group. Its department is derived and displayed as an organizational, read-only value. DIRECT categories are excluded from new service selection.
2. Adding a service from a category carries its ID, waits for all category pages, and returns to that category's Services tab after save/cancel. Invalid, unavailable and DIRECT URL contexts show a message and block creation.
3. Category descriptions distinguish a clinic, a service group, and the two booking modes. Department remains optional.
4. Hidden services belonging to DIRECT clinics are marked as clinic bookings. Their identity is managed through the clinic; pricing and booking settings remain accessible. General service deletion is blocked in UI and backend.
5. Package definitions, purchased groups, credits, SERVICE/DURATION constraints and pending purchase snapshots protect referenced services from deletion or archival. No entitlement rows are rewritten.
6. Ordinary hidden SERVICES services retain normal management. Legacy absent category and English-name values are handled separately from new-service requirements.

Source groups:

- Form/context: `apps/dashboard/components/features/services/`, `hooks/use-service-form-categories.ts`.
- Presentation: `apps/dashboard/lib/service-catalog.ts`, service columns/detail sheet and Arabic/English service translations.
- Backend: `apps/backend/src/modules/org-experience/services/archive-service.handler.ts` and `update-service.handler.ts`.
- Contract: `docs/architecture/clinic-service-booking-contract.md`; Swagger 409 description and regenerated backend OpenAPI/dashboard types.

Public/mobile response shapes, shared booking selectors, `useAllServices` and package-picker data were unchanged. The handwritten API client required no shape update.

## Environment

Before implementation, the actual website booking entry and an existing iOS simulator installation were inspected. These observations did not establish the installed app's build provenance or a full booking/payment flow.

Implementation checks used a fresh local database (`catalog_safety_qa`) and synthetic accounts/data. The 108 existing migrations were applied to this empty database. No production/provider credentials were copied.

| Resource | Isolated address / name |
|---|---|
| Backend | `http://localhost:55201/api/v1` |
| Dashboard | `http://localhost:55203` |
| PostgreSQL | `127.0.0.1:55462`, `saw-catalog-safety-pg-0927` |
| Redis | `127.0.0.1:56392`, `saw-catalog-safety-redis-0927` |
| MinIO | `127.0.0.1:59012`, `saw-catalog-safety-minio-0927` |

Logs and review are retained in `.superpowers/sdd/2026-09-27-catalog-admin-safety/` in this worktree. This is local evidence, not committed product source.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Backend selected handlers | 5 suites, 50 passed, 0 failed | `backend-tests.json` |
| Dashboard relevant unit suites | 12 files, 89 passed, 0 failed | `dashboard-tests.log` |
| Website catalog/booking selectors | 4 files, 17 passed, 0 failed | `website-tests.log` |
| Mobile catalog/booking confirmation | 4 suites, 15 passed, 0 failed | `mobile-tests.json` |
| Shared catalog/department selectors | 2 files, 15 passed, 0 failed | `shared-tests.log` |
| HTTP + local PostgreSQL | 33 checks passed | `runtime-results.json`, `runtime-check.cjs` |
| Dashboard smoke | 41 passed, 1 skipped (disabled chat); includes 4 auth setup cases | `dashboard-smoke.log` |
| Catalog browser flows | 4 scenarios + 4 auth setup passed (8 total), 0 failed | `catalog-flow-e2e-final.log` |
| Final affected dashboard unit recheck | 2 files, 16 passed, 0 failed | `dashboard-focused-final.log` |
| Backend build/typecheck/scoped lint | Passed | `backend-build.log`, `backend-typecheck.log`, `backend-lint.log` |
| Dashboard typecheck/changed-file lint | Passed; 21-file lint plus recheck of final schema/payload files | `dashboard-typecheck-final.log`, `dashboard-lint-final.log`, `dashboard-p3-lint.log` |
| Arabic/English translation parity | Passed | `dashboard-i18n-final.log` |
| OpenAPI sync | Passed; only 409 documentation/type delta | canonical snapshot/generated type diff |
| Independent Luna review | Specification/quality passed; P2/P3 introduced issues resolved; concurrency limit documented | `independent-review.md` |
| Legacy browser case repeatability | 1 scenario + 4 auth setup passed (5 total) on the same database | `catalog-legacy-repeat.log` |

Unit rechecks overlap earlier suite counts; do not add them as unique tests. Browser auth setup also appears in multiple runs.

HTTP/database checks verified internal deletion/identity-edit rejection, normal hidden-service behavior, package-reference rejection, unchanged rejected service rows/configurations, unchanged credit used/reserved quantities, and retained internal IDs in administrator listings.

### Commands

From the worktree root:

```sh
pnpm --dir apps/backend exec jest --runInBand src/modules/org-experience/services/archive-service.handler.spec.ts src/modules/org-experience/services/update-service.handler.spec.ts src/modules/org-experience/services/create-service.handler.spec.ts src/modules/org-config/categories/create-category.handler.spec.ts src/modules/org-config/categories/update-category.handler.spec.ts
pnpm --dir apps/dashboard exec vitest run test/unit/services test/unit/hooks/use-services-queries.spec.tsx test/unit/hooks/use-services-mutations.spec.tsx test/unit/lib/services-api.spec.ts test/unit/features/packages/service-option-label.spec.ts
pnpm --dir apps/website exec vitest run features/public-catalog/bookable-services.test.ts features/public-catalog/catalog.api.test.ts features/public-catalog/find-department.test.ts features/booking/booking-catalog.test.ts
pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath lib/__tests__/clinics.test.ts lib/__tests__/clinic-profile.test.ts services/client/__tests__/catalog.test.ts 'app/(client)/booking/__tests__/confirm.test.tsx'
pnpm --dir packages/shared exec vitest run catalog/bookable-clinics.test.ts catalog/find-department.test.ts
API_URL=http://localhost:55201 pnpm openapi:sync
```

Playwright used `PW_API_URL=http://localhost:55201`, `PW_DASHBOARD_URL=http://localhost:55203`, and a temporary config importing normal dashboard config with `webServer: undefined`. This avoids mistaking the existing port 5203 server for this worktree. The temporary app-local file was removed after the run; a copy is retained in local evidence and must be restored to `apps/dashboard/playwright.catalog-safety.local.config.ts` to repeat these exact commands.

```sh
pnpm --dir apps/dashboard exec playwright test --config playwright.catalog-safety.local.config.ts --project=smoke
pnpm --dir apps/dashboard exec playwright test --config playwright.catalog-safety.local.config.ts --project=flows e2e/flows/catalog-service-context.spec.ts
```

### Corrections from verification

- A backend test fixture lost its literal model-key type; the union was fixed and typecheck passed.
- A new form hook violated dashboard dependency layering. It moved into the feature; header/actions were extracted to respect the page line limit. Lint/typecheck passed.
- First browser failures concerned a required-label asterisk, a hidden Radix select and a first-page row assumption. Locators were corrected from actual DOM/screenshots; all three flows then passed without product changes.
- Independent review confirmed that an ordinary legacy `nameEn=null` became `nameEn=""` in an edit request and was rejected by backend validation. The payload now omits an unchanged absent English name and category; a real browser save preserved both null values and the service ID while changing its booking buffer. The regression passed through UI, API validation and PostgreSQL readback.
- A secondary review note found that clearing a populated English name was accepted by the relaxed edit schema. The final schema uses the saved name: a populated name remains required, while null/blank legacy names and absent categories retain independent compatibility. The focused regression covers all cases.
- Repeating the nullable browser fixture initially hit an existing backend duplicate-name check because the prior test left `nameEn=null`. The test now restores only its own synthetic row's unique English name in `finally`. The exact prior synthetic row was restored after readback checks; no unrelated record was edited. Evidence: `e2e-fixture-restore.json`.

Final screenshot: [service creation with derived department](/Users/tariq/.codex/visualizations/2026/09/26/01a0dfd9-9b12-7312-b53f-5a015585f56d/sawaa-service-form-implemented.png). It contains synthetic test names.

## Limits

- No staging, production, real-device, provider sandbox or complete payment E2E claim. Website/mobile tests cover the scoped catalog/booking contract.
- Package references are plain IDs without cross-module foreign keys. The guard checks current references; it does not serialize a concurrent package write between lookup and deletion. Closing this pre-existing race requires coordinated package-writer/database work. These checks provide no concurrency guarantee.
- The pending-purchase guard reads pending snapshot JSON; large-volume production performance was not benchmarked.
- Historical/archived package references conservatively prevent deletion too. Existing entitlements retain their service.

## Team and measurement

- User override: native GPT-6 Luna. Form/backend workers: high; presentation/E2E worker: medium; independent reviewer: high. Astra coordinated integration and runtime verification.
- Policy `astra-effort-v1`; class `coding`, complexity `high`.
- Receipt: `/Users/tariq/.codex/routing-review/catalog-safety-receipts/tasks/catalog-safety-implementation-20260927.json`.
- Baselines were late; full task token consumption, elapsed time and savings are unknown. Coordinator history contains multiple models. Scope remains incomplete and is not eligible for cost comparisons.
- Corrections are recorded above. No exhausted-quota retry or paid fallback.

Final acceptance: scoped implementation and final regression gates passed. No unresolved introduced review finding remains. The existing concurrent package-write/delete limitation above is retained explicitly.

Runtime teardown: only this task's backend/dashboard processes and three named test containers were stopped. Containers/data, worktree, uncommitted source and local evidence remain recoverable. No other running checkout was changed.

Acceptance timestamp: 2026-09-26T23:41:32.800155+00:00. Receipt window since its late start: 45.4 minutes; this excludes earlier review/planning and is not full task elapsed time. Final Git whitespace check passed; no migration or lockfile changes.
