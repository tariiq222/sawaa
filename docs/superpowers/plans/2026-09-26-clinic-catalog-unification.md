# Clinic Catalog Unification Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. User explicitly requested immediate delegated implementation; do not commit, push, merge, deploy, or ask again to begin. Steps use checkbox tracking.

**Goal:** توحيد العيادات والخدمات والحجز وتوثيق العقد لكل مبرمج.
**Architecture:** Keep one Service-based booking engine. Add explicit category kind, enforce stable booking mode, and share pure discovery selectors across clients.
**Tech Stack:** NestJS/Prisma/Postgres, Next.js, Expo, TypeScript, Jest/Vitest.
**Spec:** ../specs/2026-09-26-clinic-catalog-unification-design.md

## Global Constraints
- Work only in the isolated clinic-catalog-unification worktree; preserve unrelated changes. No commit/push/merge/deploy/destructive DB actions.
- kind = CLINIC | SERVICE_GROUP; bookingMode = DIRECT | SERVICES. SERVICE_GROUP requires SERVICES.
- Existing categories default CLINIC; no name-based backfill. Booking mode is immutable after create.
- serviceId stays booking identity; DIRECT internal service never becomes a separate customer choice.
- No auth/payment/AAD/VAT changes; no new dependencies; immutable migrations.
- Workers have disjoint ownership, no children, no build/lint/full suites. Only explicitly named focused red/green diagnostics; coordinator owns generation/build/integrated verification.

## Review Focus
1. Existing DIRECT category has visible services before its hidden service: settings must use hidden (Task 3).
2. Public profile of direct-only practitioner: opted-in detail must remain bookable (Task 1/2).
3. Renamed/hidden department and category without department must not disappear (Task 2).
4. Clinic-scoped navigation must not offer another clinic's service (Task 2).
5. A saved category changes bookingMode: reject without writes; repeated same mode remains valid (Task 1/3).

### Task 1: Backend contract and invariants — Sol medium
**Files:** backend prisma/schema/organization.prisma, new migration, org-config/categories handlers/DTOs/tests, org-experience/services create/update handlers/tests, public catalog/category response DTOs, people public employee detail/controller/tests; matching api-client declarations only if present. Excludes generated snapshots (coordinator).
**Interfaces:** Persist `kind: 'CLINIC' | 'SERVICE_GROUP'`; optional create/update DTO field; default CLINIC. GET public/employees/:key accepts `includeDirectClinics=true`, default false. Expose kind in category responses including embedded department categories.
- [x] Add focused failing cases before implementation: invalid SERVICE_GROUP+DIRECT; mode transition conflicts; unchanged mode succeeds; rename syncs internal service; visible DIRECT service create/move fails; detail opt-in includes hidden DIRECT service but default excludes it.
```ts
await expect(handler.execute({categoryId:'c',bookingMode:'SERVICES'})).rejects.toMatchObject({status:409});
expect(prisma.serviceCategory.update).not.toHaveBeenCalled();
```
- [x] Add enum CategoryKind and additive migration `20260926180000_add_category_kind`; no bulk update. Add validation and transaction-safe internal naming; preserve historical snapshots.
- [x] Add detail endpoint query and filters aligned with list path. Do not expose generic hidden services or inactive categories. Exclude internal base price from minServicePrice.
- [x] Add contract comments linking docs/architecture/clinic-service-booking-contract.md. Report focused test commands, changed files and concerns to task-1-report.md.

### Task 2: Shared selectors and customer clients — Sol medium
**Files:** packages/shared/catalog/**; apps/mobile catalog/employees services, clinics library, clinic/therapist/employee discovery routes and tests, home/explore service discovery where needed, i18n keys; apps/website features/public-catalog, booking catalog presentation, therapists API, navigation and discovery tests. Excludes CLAUDE.md (coordinator).
**Interfaces:** `selectBookableClinicEntries(catalog, employees)` -> `{category,bookingMode,directServiceId,serviceIds,therapistCount,serviceCount}[]`; `getCategoryBookingServices(category, services)`; `getDirectClinicService(services)` returns one hidden service or undefined, never first visible. Generic structural types preserve category/service extra fields.
- [x] Test new cases against current behavior: direct-only clinic present without synthetic service count, group omitted from clinic directory, renamed/hidden/no department allowed, input arrays unmodified, normal services exclude internal, invalid scoped profile fails closed.
```ts
expect(selectBookableClinicEntries(catalog, employees)[0]).toMatchObject({directServiceId:'internal',serviceCount:0});
expect(selectBookableClinicEntries(groupCatalog, employees)).toEqual([]);
```
- [x] Implement pure helpers with legacy defaults kind=CLINIC and mode=SERVICES, active/archive checks. Export through catalog/index.ts. Notify coordinator once API ready; coordinator builds dist before consumer diagnostics.
- [x] Replace website/mobile clinic derivation with helper; opt in catalog/list/detail requests; direct display uses category name. Preserve clinicId/serviceId from discovery to profile/booking, avoiding broadening invalid context. Keep existing payment/auth untouched.
- [x] Keep separate clinic and visible-service discovery links; expose supporting services without mislabeling groups as clinics; add minimal bilingual labels and tests. Report to task-2-report.md.

### Task 3: Admin catalog consistency — Luna medium
**Files:** apps/dashboard service category/settings/employees form/columns/tests, lib/types/service.ts, lib/schemas/service.schema.ts, matching category API payloads, bilingual catalog strings. Excludes api.generated.ts/CLAUDE.md (coordinator).
**Interfaces:** Backend kind optional in old responses; CLINIC default. Create permits CLINIC+DIRECT/SERVICES or SERVICE_GROUP+SERVICES. Mode immutable on edit. Shared `getDirectClinicService(services)` imported from @sawaa/shared/catalog.
- [x] Write failing regression for a visible row before hidden; missing internal service yields recoverable error state and no create mutation; create kind/mode serialized; edit mode disabled.
```ts
expect(getDirectClinicService([visibleService,hiddenService])?.id).toBe(hiddenService.id);
```
- [x] Use same selector in settings and employees; remove read-triggered creation and visible fallback. Add classification selector and bilingual explanation of group vs clinic and immutable booking mode. Service group forces SERVICES for create and cannot be selected for a DIRECT saved category.
- [x] Make list labels distinguish clinics/groups and keep parent category visible in service administration; no redesign unrelated screens. Comments link canonical contract. Report to task-3-report.md.

### Task 4: Integration, developer instructions and verification — coordinator
**Files:** AGENTS.md, root/app/package CLAUDE.md appropriate links, docs/architecture/clinic-service-booking-contract.md, old public-services spec superseded notice, generated OpenAPI/dashboard types, verification report.
- [x] Document examples, sequence, API opt-in, migration compatibility, protected boundaries, developer change checklist and troubleshooting.
- [x] Read actual worker diffs; independent review of contract/invariants and targeted fix wave.
- [x] Generate Prisma client/shared dist and run `pnpm openapi:sync`; do not manually edit generated files.
- [x] Run relevant backend/shared/website/dashboard/mobile suites and affected typechecks; dashboard i18n parity; immutable migration check and dashboard smoke in isolated local environment when available.
- [x] Save exact pass/fail/skip counts and environmental gates. Leave all changes reviewable and uncommitted.

## Final acceptance

All implementation tasks and local verification completed. See [verification evidence and limits](2026-09-26-clinic-catalog-unification-verification.md). No commit, merge, deployment, or live-data classification performed.
