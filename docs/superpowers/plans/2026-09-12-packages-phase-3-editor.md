# Practitioner Package Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Deliver the approved four-step practitioner package editor with reliable flexible booking and preserved purchased credits.
**Architecture:** Nullable package owner narrows existing item constraints; purchased credits remain immutable snapshots. The dashboard stepper uses the existing RHF form and pricing functions. A shared booking eligibility helper serves regular and credit bookings.
**Tech Stack:** NestJS/Prisma/Postgres; Next.js/React/RHF/Zod; Jest/Vitest/Playwright.
**Spec:** docs/superpowers/specs/2026-09-12-packages-phase-3-editor-design.md

## Global Constraints
No production DB access. No expiry. No capacity reduction on partial refund. No payment gateway, auth/permissions, commission, client self-service or historical-data repair changes. Preserve unrelated work. Migrations additive and immutable. Regenerate OpenAPI and dashboard types. Only coordinator runs integrated validation and publishes to staging within standing authorization.
Exact cross-task contract: local:///tmp/sawaa-phase3-20260912/batch-context.md.

### Task 1: Catalog ownership
**Files:** prisma/schema/organization.prisma and people.prisma; NEW migration 20260913200000_add_package_owner/migration.sql; org-experience/session-packages create/update DTOs, handlers, package-owner.helper.ts and colocated tests. Paths under apps/backend/.
**Interfaces:** ownerEmployeeId?: string|null in create/update; ownerEmployeeId:string|null in reads. Existing NormalizedItem and buildItemCreateData carry inherited PRACTITIONER constraints.
- [ ] Test create owner inheritance and contradictory practitioner rejection before implementation.
```ts
expect(saved.ownerEmployeeId).toBe(owner.id);
expect(saved.items[0].constraints).toContainEqual(expect.objectContaining({dimension:'PRACTITIONER', mode:'INCLUDE'}));
await expect(create({...dto, ownerEmployeeId:owner.id, items:[foreignPractitionerItem]})).rejects.toThrow();
```
- [ ] Implement additive owner schema/DTO and normalization, validate active owner and eligible service offerings. Patch owner omission preserves; owner change without replacement items rejects. No purchased-credit writes.
- [ ] Add tests for unknown/inactive owner, unsupported service, general legacy no-op, omitted/null update, metadata-only edit, and atomic update; run focused catalog Jest diagnostics after coordinator generates Prisma.
- [ ] Report changed files and focused RED/GREEN evidence; coordinator reviews actual diff before integration acceptance.

### Task 2: Four-step dashboard editor
**Files:** apps/dashboard/components/features/packages/ editor files (split <=300 lines), lib/schemas/package.schema.ts + helpers, lib/types/package.ts, lib/translations/ar.packages*.ts and en.packages*.ts, package unit tests, e2e/flows/packages/.
**Interfaces:** fixed ownerEmployeeId contract; existing CreateSessionPackagePayload and scope constraints; selectionMode remains UI-only.
- [ ] Write behavior tests for step blocking and payload preservation, including old exclusion/fixed-price records.
```ts
expect(buildItemPayload(loadedLegacyItem,0)).toEqual(expectedLegacyPayload);
expect(validatedStep).toBe(false); // incomplete fixed session or flexible price
```
- [ ] Implement four persistent form steps; explicit general/practitioner; fixed/flexible plus advanced rules; price/count step and complete final review. Map local/server errors back to field step and preserve image partial success.
- [ ] Update package Playwright flows to new navigation, add fixed+flexible create/edit and narrow/RTL assertions. Use visible labels/stable semantic locators.
- [ ] Focused Vitest diagnostics only; coordinator runs browser and broad validation.

### Task 3: Booking eligibility parity and real integration evidence
**Files:** apps/backend/src/modules/bookings/create-booking/ and book-from-credit/, booking-target-eligibility.helper.ts + spec; apps/backend/test/e2e/packages/package-practitioner-editor.real-e2e-spec.ts.
**Interfaces:** helper accepts PrismaService or transaction-compatible DB plus serviceId,employeeId,durationOptionId?,deliveryType,bookingType; returns validated employeeService and selected duration as needed. Existing handler constructor public contract retained where practical.
- [ ] Write failing tests for flexible credits using inactive/foreign duration, unrelated service/practitioner, disabled delivery, and omitted delivery constrained credit.
- [ ] Extract/reuse existing regular booking eligibility, use it in credit booking. Price resolution remains in regular booking; zero credit price, locking, availability and counters unchanged.
- [ ] Add real DB tests invoking create/update/purchase/book handlers: owner A sold then template B leaves snapshot A, valid chosen service books with one reservation, invalid target yields no booking/usage/counter change.
```ts
expect(afterCredit.constraints).toEqual(beforeCredit.constraints);
expect(afterCredit.netValue).toEqual(beforeCredit.netValue);
expect(booked.price.toString()).toBe('0');
expect(afterCredit.reservedQuantity).toBe(beforeCredit.reservedQuantity+1);
```
- [ ] Focused Jest only; no real DB access by worker. Coordinator registers and runs real spec with REAL_E2E_DATABASE_URL.

### Task 4: Integrated verification and staging
**Files:** shared types/schema only when needed; OpenAPI/generated dashboard types; critical test config; release artifacts outside source.
- [ ] Generate Prisma and run baseline package tests in isolated worktree.
- [ ] Integrate A/B/C; root actual-diff inspection + independent scoped code review; repair verified findings in a bounded batch.
- [ ] Run focused suites, root typecheck, backend/dashboard builds, lint, AR/EN parity, migration immutability and OpenAPI drift. Run critical real DB suite and dashboard smoke + package flows on owned local DBs/runtime.
- [ ] Commit scoped reviewed source; PR to develop; verify required CI and exact tree; deploy staging under standing authorization.
- [ ] Verify staging revision/migration and synthetic owner package create/edit/flexible booking/refund regression through authenticated API + browser; leave reviewable fixtures and final report. No production access.
