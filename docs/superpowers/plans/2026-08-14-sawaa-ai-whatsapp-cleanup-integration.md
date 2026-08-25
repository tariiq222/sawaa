# Sawaa Ai WhatsApp Cleanup and Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove active WhatsApp surfaces and dependencies safely, then prove the assembled Sawaa Ai customer journey across backend, website, and dashboard.

**Architecture:** First produce a machine-checked inventory, then unregister WhatsApp runtime and UI surfaces while preserving historical schema/data. Delete only code proven unreachable. Finish with OpenAPI, integration, browser, and provider-readiness gates.

**Tech Stack:** NestJS, Next.js, Prisma, BullMQ, OpenAPI, Jest, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-sawaa-ai-customer-agent-settings-design.md`

## Global Constraints

- Cleanup is not data deletion.
- Do not drop WhatsApp tables, enums, records, or old migrations.
- Preserve unrelated communication providers and booking source history.
- No commits. No secret entry or copying by agents.

---

### Task 1: Produce the WhatsApp Dependency Inventory

**Files:**

- Create: `docs/operations/sawaa-ai-whatsapp-cleanup-report.md`
- Create: `scripts/check-whatsapp-runtime-disabled.mjs`
- Create focused script tests if the repository pattern supports them.

- [ ] Inventory module registration, controllers, routes, webhooks, workers, cron jobs, queues, env variables, Docker references, dashboard pages/tabs/nav, website mounts, schema tables/enums, and booking/client historical values.
- [ ] Classify each item as `REMOVE_RUNTIME`, `DELETE_DEAD_CODE`, or `PRESERVE_HISTORY` with exact paths.
- [ ] Implement a static guard that fails when prohibited WhatsApp runtime registrations or visible navigation return.
- [ ] Run the guard against the current tree and record expected red evidence.

### Task 2: Unregister WhatsApp Runtime

**Files:**

- Modify module/bootstrap files identified by Task 1.
- Modify cron/EventBus registrations identified by Task 1.
- Modify env validation/examples and Docker/CI references identified by Task 1.
- Add focused module-compile and registration specs.

- [ ] Add failing tests proving webhook/controllers/workers/cron/queues are not registered while non-WhatsApp comms still compile.
- [ ] Remove runtime registrations and imports without editing schema or migrations.
- [ ] Remove obsolete required env checks only after no runtime consumer remains.
- [ ] Run focused Nest compile/metadata tests and static guard.

### Task 3: Remove Visible WhatsApp Surfaces

**Files:**

- Modify: `apps/dashboard/app/(dashboard)/settings/page.tsx`
- Modify sidebar/navigation and translation fragments identified by Task 1.
- Delete dead WhatsApp UI files only when no import remains.
- Add focused dashboard tests.

- [ ] Add failing tests proving no WhatsApp tab, nav link, icon, route mount, or visible copy remains and `Sawaa Ai` settings is present.
- [ ] Remove mounts and dead UI imports; preserve generic conversation inbox.
- [ ] Run Dashboard focused tests, typecheck, i18n parity, and static guard.

### Task 4: Delete Proven Dead WhatsApp Code

**Files:**

- Delete only files classified `DELETE_DEAD_CODE` and confirmed by `rg` plus module graph.
- Update test/config barrels that reference deleted code.

- [ ] For each candidate directory, prove no runtime import or shared consumer remains.
- [ ] Delete in bounded batches and run backend typecheck/module compile after each batch.
- [ ] Keep schema models, enums, data, and migrations; document them under `PRESERVE_HISTORY`.
- [ ] Update the cleanup report with exact retained residues and rationale.

### Task 5: Assembled Integration and Browser Verification

**Files:**

- Modify/add backend integration tests under existing chat E2E/smoke locations.
- Modify/add website Playwright chat spec.
- Modify/add dashboard Playwright conversations/settings spec.
- Regenerate OpenAPI and generated types.

- [ ] Test guest greeting → natural Sawaa Ai reply with a controlled provider adapter.
- [ ] Test service discovery → grounded recommendation → login → existing-booking warning → confirmation card.
- [ ] Test handoff detail collection → reception inbox summary → claim/reply/close.
- [ ] Test provider invalidation → retry/handoff state and settings `RETEST_REQUIRED`.
- [ ] Test knowledge draft exclusion → publish/reindex → grounded answer.
- [ ] Run OpenAPI sync and ensure all generated clients/typechecks pass.
- [ ] Run focused backend, website, dashboard, and API-client suites; then root typecheck/build where proportionate.
- [ ] Run live browser verification against local 5200/5203/5205.
- [ ] Run a real provider completion only after the user enters a valid key through the approved surface; never print or copy the key.
- [ ] Deliver exact green evidence and explicitly label any real-provider or live-DB gate still blocked.
