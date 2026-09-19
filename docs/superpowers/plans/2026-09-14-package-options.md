# Package options and client journey implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development with the project routing and ownership rules. Root runs integration gates; no commits/push/deploy are authorized.

**Goal:** One catalog package with creator-defined total-session choices, then authenticated website/mobile purchase, balance, and credit booking.
**Architecture:** PackageFamily wraps existing GROUPED_V2 SessionPackage offers. Each offer retains its own groups/discount and existing pricing/purchase activation pipeline. Purchases freeze family/option metadata. Existing standalone packages are projected as one-option families for client reads; no old rights rewritten.
**Tech Stack:** NestJS/Prisma/Postgres, shared TypeScript/Zod, Next dashboard/website, Expo mobile.
**Spec:** docs/superpowers/specs/2026-09-14-package-options-design.md (approved 2026-09-14).

## Global constraints

- Count means all sessions, including scales; derive from actual groups/items.
- No production DB access, secrets changes, commits, pushes or deployments. Preserve existing dirty work.
- Integer halalas; existing registered practitioner options; individual session overrides and total discount.
- Family/offer membership and active/public/archive rules validated server-side; zero-price checkout retains existing online minimum policy.
- Preserve old standalone purchase behavior and frozen rights; additive migration only.
- Keep existing auth guards unchanged; client IDs derived from ClientSession. Reuse centralized booking eligibility/sequence logic.
- Native Luna-high implementation; root owns schema/shared contracts/generated code and final gates. Workers never spawn or run full build/lint/test suites.
- Write focused behavioral tests first; root runs failing tests before implementation and passing tests after the batch. No source-text-only claims.

## Shared API contracts

`PackageFamilyInput`: metadata nameAr/nameEn/descriptionAr/descriptionEn/imageUrl, isActive/isPublic/sortOrder, options[]. Each option has optional id (existing child only), nameAr/nameEn, isActive/isPublic, groups and globalDiscount. Updates submit full option list; removed offers archive rather than erase rights. Cannot move an option from another family.

`PackageFamily`: metadata/id/options; `isStandalone` true only for read projection of existing ungrouped packages. `PackageFamilyOption` extends SessionPackage with price and sessionCount. Public detail/list return only public active unarchived family+options; family hidden when no sellable options. `/public/package-families` and `/:id`; dashboard `/dashboard/organization/package-families` CRUD. Existing standalone list excludes attached offers by default.

Checkout: existing `{packageId, branchId, idempotencyKey}` plus `packageFamilyId?: string`; `packageId` is selected offer. Attached offers require exact family ID. Server freezes `offerSnapshot` {familyId,familyNameAr,familyNameEn,optionNameAr,optionNameEn,sessionCount}. Existing idempotency fingerprint includes optional family selection for new calls without changing hashes for old standalone calls.

Client `/mobile/client/packages/purchases` reads own purchases with decorated credits and frozen names, `/mobile/client/packages/purchases/:id` reads own status for checkout polling, POST `/mobile/client/packages/book` receives {creditId,branchId,scheduledAt} and optional supported target fields needed for LEGACY credit resolution. Client handler validates ownership and active purchase then delegates existing BookFromCreditHandler. No arbitrary clientId/userId accepted.

## Task 1: Shared contracts and additive schema (root)

Files: packages/shared/types/package-family.ts; shared types/index.ts; prisma/schema/organization.prisma and bookings.prisma; new migration 20260914120000_add_package_families.
- [ ] Add PackageFamily metadata table, nullable SessionPackage.familyId relation/index, nullable PackagePurchase.offerSnapshot JSON.
- [ ] Add interfaces described above and exports; preserve existing types.
- [ ] Validate/generate Prisma and apply only isolated local test DB via guarded runner; inspect generated migration nullability and no data updates.

## Task 2: Family management/catalog and checkout snapshots (Luna backend)

Files: new modules/org-experience/package-families/ slices and api/dashboard/package-families.controller.ts; api/public/package-families.controller.ts; org/public/dashboard module wiring; existing package create/update/group helper, session package lists; finance create/init/list purchase slices and DTOs.
- [ ] Tests: create 5/9 options yields one family; atomic failure of second option leaves no family/offer; cross-family option update rejected; public filtering; checkout mismatched/hidden option rejected; old fingerprint unchanged; purchase metadata freezes.
- [ ] Implement transactional family create/update using shared grouped write validation; don't call independently committed create handlers from an outer pseudo transaction.
- [ ] Filter child offers out of standalone listings, provide computed price/count; use public-safe projections.
- [ ] Reuse checkout providers unchanged; validate selection, freeze offerSnapshot in both purchase paths; render snapshots in purchase list.
- [ ] Root executes focused tests and realDB suite with 5/9 purchases, edits/archives after pending purchase, old purchases regression.

## Task 3: Dashboard family editor and sale (Luna dashboard; parallel after Task1)

Files: apps/dashboard/components/features/packages/family-*; existing package list/create/edit routing, grouped form components; family API/hooks/schema; sale dialog; translations/tests. Worker owns dashboard except generated api types.
- [ ] Component tests first for add/copy/remove option, derived 5/9 counts, independent group/discount state, validation preventing empty options.
- [ ] Reuse grouped editor inside option selection. Common metadata once, options overview with count and total; copy option regenerates local keys as needed, clears persisted id.
- [ ] Integrate family list/detail/editor and sale selection with packageFamilyId/selected packageId; keep old standalone edit path available.
- [ ] Root browser creates family, selects 5 then9, verifies separate totals and sale snapshot; cancel editor does not create abandoned options.

## Task 4: Client purchase/balance/credit booking API (root coordination + Luna backend-client)

Files: api/mobile/client/packages.controller.ts and mobile-client.module.ts; modules/bookings/client/*package*; finance exports; shared/api-client types and methods (root owns shared/API-client).
- [ ] Test another client's purchase/credit returns non-disclosing failure; caller clientId cannot override session; reserved/locked credit denied.
- [ ] Reuse existing ClientSessionGuard and balance decorator, validate ownership before delegated operations, resolve V2 snapshot fields server-side.
- [ ] Own pending status read supports payment-return polling; no mutation activates credits without payment confirmation.
- [ ] Root generates OpenAPI, updates typed client, runs HTTP ownership/sequence/old behavior coverage.

## Task 5: Website journey (Luna website; after client contracts)

Files: apps/website/app/packages/{page,[id]/page,purchase/page}; features/packages/*; account balances tab/navigation and booking-from-credit page; tests. Read website CLAUDE.
- [ ] Tests for public 5/9 selection, login return URL preserving selection, failure/pending/success transitions, locked reason and owned credit booking.
- [ ] Catalog/detail option summary -> authenticated init existing payment endpoint -> redirect -> server status poll -> balance -> availability -> credit booking.
- [ ] Money formatting uses halalas; accessible RTL controls and loading/error/empty states. Reuse existing HTTP/auth/availability conventions; no fake payment success.
- [ ] Root Vitest/build and browser journeys with controlled provider test response; distinguish real Sandbox blocked state.

## Task 6: Mobile journey (Luna mobile; parallel with website)

Files: apps/mobile/services/client/packages.ts; hooks/queries/usePackages.ts; app/(client)/packages/* and navigation, translations/tests. Read mobile CLAUDE.
- [ ] Service/screen tests for selected IDs, totals, authorization failures, pending return, locked/available credits.
- [ ] Native catalog/detail/purchase return and balances/booking screens using registered client Axios/auth and existing browser payment return mechanism.
- [ ] Root runs mobile typecheck/Jest separately, then simulator if available. No claim device acceptance without actual runtime evidence.

## Integration and acceptance (root)

- [ ] Spec compliance and diff-quality review for each completed package; return defects to owning Luna.
- [ ] Shared/API typecheck + OpenAPI sync; relevant full backend/dashboard/website tests, mobile checks separately, dashboard smoke.
- [ ] Real DB: family 5/9 issue 5/9 exact rights, source changes never reprice old rights, stale option rejected, idempotency and races preserved.
- [ ] UI acceptance screenshots RTL desktop/mobile widths; actual selection/purchase/balance/book paths.
- [ ] Report remaining staging/Moyasar limitations explicitly, keep evidence and worktree. Do not commit or deploy automatically.
