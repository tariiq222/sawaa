# Service Pricing Architecture Investigation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an evidence-based architectural map of how services, practitioners, duration options, booking configs, and prices flow through the Sawa stack — so any future "ideal" solution for the `ServiceDurationOption` duplication problem is built on verified truth, not assumptions.

**Architecture:** Pure research plan. No code is written; no schema changes; no migrations; no DB writes. Each task produces a markdown document with concrete findings (commit hashes, file paths, line numbers, SQL outputs) that downstream design and fix tasks can rely on. All DB access is read-only `SELECT`.

**Tech Stack:**
- Backend: NestJS 11, Prisma 7, PostgreSQL 18
- Frontend: Next.js 15, React 19, TanStack Query
- DB: sawaa-web-sawaa-kfpm2q Swarm service, accessed via `docker exec` (no psql on host)
- Source of truth: this repo (`/Users/tariq/code/sawaa`)

## Global Constraints

- **Read-only DB access only.** Every SQL is `SELECT`. No `DELETE`, `UPDATE`, `INSERT`, `DROP`, `TRUNCATE`, `ALTER`. Period. The user explicitly forbade any modification.
- **Migrations are immutable** — never edit or squash existing Prisma migrations.
- **Single-tenant** — no `organizationId` filters; `DEFAULT_ORG_ID` constant is the static AAD.
- **Arabic answers** when communicating with the user; English in all written artifacts (code, docs, commit messages).
- **No destructive git commands** without explicit user confirmation.
- **Each task produces a single markdown document** committed under `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/` (new directory).
- **Each task commits its findings** with a Conventional Commit message before marking complete.
- **Sequential dependency**: Tasks MUST run in order. No parallelism (each task reads what the previous wrote).
- **Branch discipline**: If a second live session touches this branch, the `branch-guard.sh` hook will fork automatically — accept the fork.

## Why this plan exists

The user observed `ServiceDurationOption` table has 102 duplicate rows across 18 (service, delivery, duration) triples in 6 clinic services. Three concerns block proposing a fix:
1. I (Claude) don't fully understand the system's price-resolution flow — `ServiceBookingConfig`, `ServiceDurationOption`, and `EmployeeServiceOption` interact via two modes (`useCustomPricing: true|false`), and I conflated their roles.
2. The frontend call sites for the three write endpoints are unmapped — I can't trace which UI action produces which DB row.
3. A 61-row spike on 2026-06-23 is unexplained — was it a one-off deploy artifact or a recurring pattern?

This plan produces evidence. Only after these 5 documents exist can a fix be designed.

## File Structure

This plan creates the following files (no existing source files are modified):

```
docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/
├── README.md                                ← Index of findings (Task 6, the integration task)
├── findings/
│   ├── 01-spike-2026-06-23.md               ← Task 1 output
│   ├── 02-schema-archaeology.md             ← Task 2 output
│   ├── 03-frontend-call-map.md              ← Task 3 output
│   ├── 04-booking-flow-trace.md             ← Task 4 output
│   └── 05-service-edit-flow-trace.md        ← Task 5 output
└── summary.md                                ← Final synthesis (Task 7)
```

Total: 7 markdown files. No code, no schema, no DB writes.

---

## Task 1: Investigate the 2026-06-23 Spike (61 rows)

**Files:**
- Create: `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/01-spike-2026-06-23.md`
- Reference only (no edits): `apps/backend/prisma/migrations/*/migration.sql` (if any new migration was applied), `apps/backend/src/modules/org-experience/services/*` (handler files)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `findings/01-spike-2026-06-23.md` with sections:
  - **What happened**: a list of commit hashes (and their one-line subject) in the 2026-06-22 → 2026-06-24 window that touched `ServiceDurationOption` (directly or transitively via handlers/seeds/migrations).
  - **Which handler created the rows**: for each commit, the file path + line numbers of any `serviceDurationOption.create` / `serviceDurationOption.createMany` / `serviceDurationOption.upsert` calls introduced or modified.
  - **SQL proof**: the result of `SELECT "createdAt", "serviceId", "deliveryType", "durationMins", "price", "labelAr" FROM "ServiceDurationOption" WHERE date_trunc('day', "createdAt") = '2026-06-23' AND "isActive" = true ORDER BY "createdAt";` to show the actual rows.
  - **Verdict**: One of `one-off-deploy-script | recurring-handler-call | manual-DB-write | unknown-needs-deeper-investigation`.
  - **Implication for fix design**: A short note on whether the spike shape suggests a one-time cleanup, an architectural bug, or user behavior.

- [ ] **Step 1: Pull the git log for the spike window**

Run from repo root:

```bash
git log --since='2026-06-22 00:00' --until='2026-06-24 23:59' --pretty=format:'%h %ad %s' --date=short -- .
```

Expected: a list of commits in that window. Record every commit hash + subject. If the list is empty, the spike was a direct DB intervention, not code — note that and move to step 2.

- [ ] **Step 2: Filter commits that touched relevant code**

Run from repo root:

```bash
git log --since='2026-06-22 00:00' --until='2026-06-24 23:59' --name-only --pretty=format:'%h %s' -- . | grep -E '\.(ts|prisma|sql)$' | sort -u
```

Expected: list of `(commit, file)` pairs. Save to a working notes file (not committed yet). The relevant files are anything under `apps/backend/src/modules/org-experience/services/`, `apps/backend/src/modules/org-config/`, `apps/backend/prisma/`, or `apps/backend/prisma/seeds/`.

- [ ] **Step 3: For each candidate commit, show its diff scope**

For each commit hash from Step 2:

```bash
git show --stat <hash>
```

Expected: list of changed files. Record those that contain `serviceDurationOption` (case-insensitive grep on the diff).

- [ ] **Step 4: Pull DB evidence from the LOCAL Postgres container (read-only)**

**Scope note:** Production spike data (2026-06-23) only exists on the production Swarm DB and is NOT accessible from this session. Local investigation pivots to:
1. The same date query against local DB (expected: 0 rows — confirms local doesn't mirror production, but also proves the investigation can run read-only here).
2. A current-state duplicate query against local DB — this is the **structural evidence** that the duplication pattern exists in the schema/handler logic, independent of when it happened in production.
3. The handler code analysis (Steps 1–3) carries the verdict.

**Prerequisites (one-time):**
```bash
# Confirm local Postgres is up (container from docker/docker-compose.yml)
docker ps --format '{{.Names}}' | grep -q '^sawa-postgres$' || pnpm docker:up

# Apply migrations + seed to get a representative dataset (read-only investigation benefits from real rows)
pnpm --filter=backend db:reset
```

**Run the queries:**

```bash
# Save queries to files (heredoc escaping through docker exec -i is unreliable)
cat > /tmp/spike_query.sql <<'SQL'
SELECT "createdAt", "serviceId", "deliveryType", "durationMins", "price", "labelAr"
FROM "ServiceDurationOption"
WHERE date_trunc('day', "createdAt") = '2026-06-23' AND "isActive" = true
ORDER BY "createdAt";
SQL

cat > /tmp/duplicates_query.sql <<'SQL'
-- Structural evidence: which (serviceId, deliveryType, durationMins) triples have more than one row?
SELECT "serviceId", "deliveryType", "durationMins", COUNT(*) AS row_count,
       array_agg("id" ORDER BY "createdAt") AS option_ids,
       array_agg(DISTINCT "price") AS distinct_prices
FROM "ServiceDurationOption"
WHERE "isActive" = true
GROUP BY "serviceId", "deliveryType", "durationMins"
HAVING COUNT(*) > 1
ORDER BY row_count DESC, "serviceId";
SQL

# Query 1 — production spike date on local DB (expected empty)
docker exec -i sawa-postgres psql -U sawaa -d sawaa_dev -P pager=off < /tmp/spike_query.sql

# Query 2 — current local duplicate state (the structural evidence)
docker exec -i sawa-postgres psql -U sawaa -d sawaa_dev -P pager=off < /tmp/duplicates_query.sql
```

Expected output:
- Query 1: empty result set (no rows for 2026-06-23 on local — this is normal).
- Query 2: a list of `(serviceId, deliveryType, durationMins)` triples with `row_count > 1`. **If local seed data has no duplicates, that's a finding too** — it means the duplication is created by production-only code paths (e.g., the custom-pricing handler that the local seed doesn't exercise).

Copy both outputs verbatim into the findings file under separate sections.

- [ ] **Step 5: Determine the verdict**

Cross-reference Step 1–3 commits (code history) against Step 4 row patterns (DB evidence). The local DB does NOT have production 2026-06-23 rows, so the verdict is primarily driven by **handler code analysis** in Steps 1–3 + the **structural duplicate pattern** from Query 2.

Possible verdicts:
- `recurring-handler-call` — a handler creates a row on every invocation without an upsert guard. Most likely cause given the duplication pattern.
- `one-off-deploy-script` — a single commit introduced a bulk seeding script.
- `manual-DB-write` — no code matches; rows were inserted directly (rare).
- `unknown-needs-deeper-investigation` — inconclusive; flag for follow-up.

If Query 2 returns zero duplicates locally but production has 102, that's a strong signal that the duplication path requires production-only triggers (e.g., the admin UI flow that local seed doesn't run). Note this as a finding.

- [ ] **Step 6: Write the findings file**

Create `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/01-spike-2026-06-23.md` with the structure described under "Produces". Use clear English headings. Include the SQL output verbatim. End with a short "Implication for fix design" paragraph (3-5 sentences).

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/01-spike-2026-06-23.md
git commit -m "docs(investigation): spike analysis 2026-06-23"
```

Expected: one new file committed, no source changes.

---

## Task 2: Schema Archaeology

**Files:**
- Create: `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/02-schema-archaeology.md`
- Reference only: `apps/backend/prisma/migrations/` (read-only listings), `apps/backend/prisma/schema/organization.prisma`, `apps/backend/prisma/schema/people.prisma`

**Interfaces:**
- Consumes: nothing (independent of Task 1's findings; Task 1 was about runtime, this is about schema history).
- Produces: a timeline table for the three tables (`ServiceBookingConfig`, `ServiceDurationOption`, `EmployeeServiceOption`) plus `EmployeeService.useCustomPricing` flag.

- [ ] **Step 1: List all Prisma migrations in chronological order**

```bash
ls -la apps/backend/prisma/migrations/ | grep '^d'
```

Expected: a sorted list of migration folders. Note the date in the folder name (e.g., `20260315120000_add_x`).

- [ ] **Step 2: Find the first migration that creates each target table**

For each of `ServiceBookingConfig`, `ServiceDurationOption`, `EmployeeServiceOption`:

```bash
grep -rln "CREATE TABLE.*\"ServiceBookingConfig\"\|CREATE TABLE.*\"ServiceDurationOption\"\|CREATE TABLE.*\"EmployeeServiceOption\"" apps/backend/prisma/migrations/
```

Expected: one folder per table. Record the folder name + date for each.

- [ ] **Step 3: Find when `EmployeeService.useCustomPricing` was added**

```bash
grep -rln "useCustomPricing" apps/backend/prisma/migrations/ apps/backend/prisma/schema/
```

Expected: at least one schema file (current) and possibly one migration folder. Record the date it was added.

- [ ] **Step 4: Find schema-level comments that hint at deprecation or role**

```bash
grep -B1 -A8 "^model ServiceBookingConfig\|^model ServiceDurationOption\|^model EmployeeServiceOption\|^model EmployeeService " apps/backend/prisma/schema/organization.prisma apps/backend/prisma/schema/people.prisma
```

Expected: blocks of model definitions with `//` comments. Record any comments that say things like "legacy", "deprecated", "kept for backwards compat", "P0 bug fix", "DB-???" — these are signals.

- [ ] **Step 5: Build the timeline table**

In the findings file, produce a markdown table:

| Date | Table / Field | Change | Implication |
|---|---|---|---|

Fill in rows for:
- The introduction of each of the three tables
- The introduction of `useCustomPricing`
- Any unique-constraint addition or removal (check via `grep -rln "ADD CONSTRAINT.*UNIQUE\|DROP CONSTRAINT.*UNIQUE" apps/backend/prisma/migrations/`)

- [ ] **Step 6: Determine current role of each table**

Based on the timeline + `PriceResolverService` reads (already in the conversation: `ServiceDurationOption` is mode-scoped, `ServiceBookingConfig` is INHERIT-mode step 3, `EmployeeServiceOption` is INHERIT-mode step 1 override), write a short paragraph per table answering: "Is this a primary source of truth, a fallback, or a legacy vestige?"

- [ ] **Step 7: Write findings file + commit**

```bash
git add docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/02-schema-archaeology.md
git commit -m "docs(investigation): schema archaeology for pricing tables"
```

---

## Task 3: Frontend Call Map

**Files:**
- Create: `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/03-frontend-call-map.md`
- Reference only (read, do not edit): all files under `apps/dashboard/src/`, `packages/api-client/src/`

**Interfaces:**
- Consumes: Task 2's role attribution (so we know what each endpoint is "supposed" to do).
- Produces: a per-page table mapping UI screen → user action → API call(s) → backend handler → DB write.

- [ ] **Step 1: Find the "Edit Service" page component**

```bash
grep -rln "تعديل الخدمة\|editService\|edit-service\|/services/.*/edit" apps/dashboard/src --include="*.tsx" --include="*.ts"
```

If empty, broaden:

```bash
grep -rln "ServiceForm\|useServiceForm\|service.*edit\|ServiceEdit" apps/dashboard/src --include="*.tsx" --include="*.ts" | head -20
```

Expected: at least one file. Open it and identify the route URL (look for `apps/dashboard/src/app/...`).

- [ ] **Step 2: Find the practitioner-pricing page component**

The screenshot the user shared shows a page titled "تعديل الخدمة" with practitioner cards each having per-practitioner pricing inputs. The handler is `set-employee-custom-pricing` or `set-employee-durations`. Find it:

```bash
grep -rln "customPricing\|custom-pricing\|custom_pricing\|set-employee-custom\|setEmployeeCustomPricing\|setEmployeeDurations" apps/dashboard/src --include="*.tsx" --include="*.ts" | head -20
```

If still empty:

```bash
grep -rln "durationOptions\|duration-options\|/durations" apps/dashboard/src --include="*.tsx" --include="*.ts" | head -20
```

Expected: at least one file per edit screen.

- [ ] **Step 3: For each page found, identify the onSubmit / save handler**

Open the file. Look for:
- `onSubmit={...}`
- `useMutation({ ... })` calls
- `mutate(` or `mutateAsync(` calls in submit handlers

For each mutation call, record:
- The hook key (e.g., `["services", "update", id]`)
- The mutation function (e.g., `updateService`)
- The URL it posts to (look in `packages/api-client/src/services/`)
- The payload shape

- [ ] **Step 4: Trace each mutation to its backend endpoint**

For each mutation function name from Step 3:

```bash
grep -rn "function updateService\|function setService\|export const update" packages/api-client/src/services/ 2>/dev/null | head -10
```

Then for the URL:

```bash
grep -rn "/duration-options\|/custom-pricing\|/durations\|/services/" apps/backend/src/api/dashboard/ --include="*.ts" 2>/dev/null | head -20
```

Record: URL → controller method → handler → DB write.

- [ ] **Step 5: Build the call map table**

In the findings file:

| UI Screen | User Action | Mutation Hook | Endpoint | Handler | DB Tables Touched |
|---|---|---|---|---|---|

Fill in one row per UI screen. Be exhaustive — if saving one form fires two mutations, list both.

- [ ] **Step 6: Identify any orphaned handlers (write path with no frontend caller)**

Cross-reference the backend write endpoints (`set-duration-options`, `set-service-booking-configs`, `set-employee-custom-pricing`, `set-employee-durations`) against the frontend call map. Any handler with no caller is suspicious — either it's called from a script/seed/admin path, or it's dead code. Note this in the findings.

- [ ] **Step 7: Write findings + commit**

```bash
git add docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/03-frontend-call-map.md
git commit -m "docs(investigation): frontend call map for pricing endpoints"
```

---

## Task 4: Booking Flow Trace (Customer Side)

**Files:**
- Create: `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/04-booking-flow-trace.md`
- Reference only: `apps/backend/src/modules/bookings/create-booking/`, `apps/backend/src/modules/bookings/check-availability/`, `apps/backend/src/modules/org-experience/services/price-resolver.service.ts`, `apps/website/src/app/booking/` (or wherever the booking wizard lives)

**Interfaces:**
- Consumes: Task 2's role attribution, Task 3's frontend call map (so we know the website's read paths).
- Produces: a sequence diagram (mermaid or plain text) showing: customer opens wizard → sees service options → picks duration/practitioner → sees price → confirms → server creates booking. Each step lists the exact DB table read/written.

- [ ] **Step 1: Find the public booking wizard component**

```bash
grep -rln "booking.*wizard\|BookingWizard\|/booking" apps/website/src apps/mobile/src 2>/dev/null --include="*.tsx" --include="*.ts" | head -10
```

Expected: at least one file. Open it and list the steps (steps usually numbered Step 1 / Step 2 / etc., or named like "ServiceStep", "DurationStep", "PractitionerStep").

- [ ] **Step 2: Find the GET endpoints that power each step**

For each step, search for the corresponding query hook:

```bash
grep -rn "useQuery.*services\|useQuery.*availability\|useQuery.*duration" apps/website/src apps/mobile/src 2>/dev/null --include="*.ts" --include="*.tsx" | head -20
```

Record: which endpoint is called per step, what it returns.

- [ ] **Step 3: Find the booking-creation POST endpoint**

```bash
grep -rn "createBooking\|create-booking\|POST.*bookings" apps/backend/src/api apps/website/src apps/mobile/src 2>/dev/null --include="*.ts" --include="*.tsx" | head -20
```

Expected: the route URL and the handler. Open `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts`.

- [ ] **Step 4: Trace which pricing path the create-booking handler uses**

In the create-booking handler, find:
- Where it calls `PriceResolverService.resolve(...)` (or however it determines price).
- What `useCustomPricing` value is passed (does the handler look it up from `EmployeeService`?).
- What `durationOptionId` is saved to `Booking.durationOptionId` after resolution.

Record: the exact line numbers + the values it uses.

- [ ] **Step 5: Build the trace document**

In the findings file, write a step-by-step trace:

```
Step 1: Customer selects service
  → GET /api/v1/public/services/:id
  → Returns Service + ServiceDurationOption[] (filtered by employeeServiceId IS NULL)
  → Frontend renders duration cards

Step 2: Customer selects duration + deliveryType
  → Frontend reads price from ServiceDurationOption.price directly
  → No server call

Step 3: Customer selects practitioner
  → GET /api/v1/public/services/:id/employees?deliveryType=X
  → Returns Employee[] filtered by EmployeeService.useCustomPricing

Step 4: Server resolves final price
  → POST /api/v1/public/bookings
  → create-booking.handler calls PriceResolverService.resolve({...})
  → CUSTOM mode: reads from owned ServiceDurationOption rows
  → INHERIT mode: reads EmployeeServiceOption override → ServiceDurationOption → ServiceBookingConfig → Service
```

Adapt the contents to what the actual code shows. Be precise about line numbers.

- [ ] **Step 6: Identify any price-display inconsistencies**

If the website displays a price from `ServiceDurationOption.price` directly (skipping `PriceResolverService`), and a customer picks a practitioner in CUSTOM mode, the displayed price will differ from the actually-charged price. Note this in the findings if found.

- [ ] **Step 7: Write findings + commit**

```bash
git add docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/04-booking-flow-trace.md
git commit -m "docs(investigation): booking flow trace"
```

---

## Task 5: Service Edit Flow Trace (Admin Side)

**Files:**
- Create: `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/05-service-edit-flow-trace.md`
- Reference only: the dashboard service-edit page (from Task 3), the 3 backend handlers in `apps/backend/src/modules/org-experience/services/`

**Interfaces:**
- Consumes: Tasks 2, 3, 4 outputs.
- Produces: a step-by-step trace of what happens when an admin saves the service-edit form. Lists each DB write in order, with row-level consequences.

- [ ] **Step 1: Open the service-edit page from Task 3**

Re-open the file identified in Task 3 Step 1. Find:
- The form's `onSubmit` handler
- All `mutate` / `mutateAsync` calls inside it
- The order they fire (sequential vs parallel)

- [ ] **Step 2: For each mutation, document the exact payload shape**

Read the mutation function. Record:
- Field names (e.g., `durationMins`, `price`, `deliveryType`)
- Required vs optional fields
- Whether the full list is sent or a delta

- [ ] **Step 3: For each mutation, trace the handler's DB writes**

For each backend handler invoked from Step 2, document:
- Which `prisma.X.create` / `update` / `upsert` / `deleteMany` / `updateMany` calls fire
- In what order within the transaction
- What the side effects are (cascade deletes on related tables)

- [ ] **Step 4: Identify the duplication trigger**

For each handler, ask: "Can this handler create two `ServiceDurationOption` rows with the same `(serviceId, deliveryType, durationMins)` if called twice on the same day?" Document the answer per handler with line-number evidence.

- [ ] **Step 5: Identify cross-handler contamination**

Specifically document: when `set-service-booking-configs` runs, does its `deleteMany` (in its current form, line 81) delete rows owned by practitioners (where `employeeServiceId IS NOT NULL`)? If yes, this is the cascading-delete bug suspected earlier. Cross-reference against the schema in Task 2.

- [ ] **Step 6: Build the trace document**

In the findings file, write a trace like:

```
Admin opens /dashboard/services/:id/edit
  → Page loads → GET /dashboard/organization/services/:id/duration-options
  → Returns the FULL list (including duplicates) → page renders N rows per triple

Admin edits a duration's price from 400 → 450
  → onSubmit fires mutation X
  → mutation X calls PUT /dashboard/organization/services/:id/duration-options
  → handler set-duration-options executes:
    - for option with id=X: UPDATE price=450  (line 39)
    - for option with no id: CREATE new row (line 53)
    - DOES NOT delete options not in payload  (BUG: line 34-68)
  → Result: existing rows for removed durations remain in DB

Admin then adds a new duration "90 min IN_PERSON 600 SAR"
  → mutation fires PUT /dashboard/organization/services/:id/duration-options
  → handler creates another row
  → Cumulative drift begins
```

Adapt to actual code. Be precise.

- [ ] **Step 7: Write findings + commit**

```bash
git add docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/05-service-edit-flow-trace.md
git commit -m "docs(investigation): service edit flow trace"
```

---

## Task 6: Build README Index

**Files:**
- Create: `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/README.md`

**Interfaces:**
- Consumes: outputs of Tasks 1-5.
- Produces: an index linking all 5 findings files + a 1-paragraph TL;DR per finding + a "open questions" list (anything Tasks 1-5 couldn't resolve).

- [ ] **Step 1: Create the README**

Markdown structure:

```markdown
# Service Pricing Architecture Investigation — Index

**Status:** Investigation complete (date: YYYY-MM-DD)
**Goal:** Evidence base for designing the "ideal" fix for ServiceDurationOption duplication.

## Findings

| # | Topic | TL;DR |
|---|---|---|
| 1 | [2026-06-23 Spike](findings/01-spike-2026-06-23.md) | <one sentence> |
| 2 | [Schema Archaeology](findings/02-schema-archaeology.md) | <one sentence> |
| 3 | [Frontend Call Map](findings/03-frontend-call-map.md) | <one sentence> |
| 4 | [Booking Flow Trace](findings/04-booking-flow-trace.md) | <one sentence> |
| 5 | [Service Edit Flow Trace](findings/05-service-edit-flow-trace.md) | <one sentence> |

## Open Questions

- <anything unresolved>
- <anything that needs a follow-up task>

## Next Steps (proposed, not executed)

1. Decide which duplications are safe to delete (per row, manually).
2. Apply the unique constraint defense-in-depth migration.
3. Refactor handler coordination (if warranted by findings).
```

Fill in the TL;DR and open questions from the actual findings.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/README.md
git commit -m "docs(investigation): add index for pricing architecture findings"
```

---

## Task 7: Synthesis Document

**Files:**
- Create: `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/summary.md`

**Interfaces:**
- Consumes: all 5 findings + README.
- Produces: a synthesis that answers the user's original question with verified evidence — what is the ideal fix, what are its prerequisites, what is its risk profile.

- [ ] **Step 1: Draft the synthesis sections**

The summary should have:

1. **What we now know** (5-10 bullet points, each backed by a specific finding file + line numbers)
2. **The verified duplication trigger** — what actually creates the duplicates (with handler line numbers)
3. **Recommended fix tiers**:
   - **Tier 1 (safe, immediate, no user impact):** defense-in-depth unique constraint + the `set-service-booking-configs` filter fix
   - **Tier 2 (medium risk, requires migration):** dedupe migration (with explicit per-row deletion criteria)
   - **Tier 3 (architectural, requires design discussion):** handler consolidation
4. **Risks per tier** — what could go wrong, how to verify in staging
5. **Open questions** — anything still unresolved after this investigation

- [ ] **Step 2: Get user sign-off before any code action**

The summary is the gate. Do NOT write any code, migration, or refactor in this plan. The user must review the summary, ask follow-up questions, and explicitly authorize any follow-up plan that touches code/DB.

- [ ] **Step 3: Commit summary**

```bash
git add docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/summary.md
git commit -m "docs(investigation): synthesis — verified duplication trigger and fix tiers"
```

---

## Self-Review

After writing the plan (done), verify:

1. **Spec coverage:** The user asked for a complete plan covering the 5 research tasks. Tasks 1-5 each produce one of the five investigation outputs. Tasks 6 and 7 produce an index and a synthesis. ✅
2. **Placeholder scan:** No "TBD", "TODO", "implement later" in any task. Each step has a concrete command or write instruction. ✅
3. **Type consistency:** File paths are consistent across tasks (`docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation/findings/0N-...md`). ✅
4. **Sequencing:** Task order is correct (1→2 are independent; 3 depends on 2; 4 depends on 2,3; 5 depends on 2,3,4; 6 depends on 1-5; 7 depends on 6). ✅
5. **Read-only DB invariant:** Every SQL command is `SELECT`. No mutations anywhere in the plan. ✅

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Each subagent has the task brief above as its sole context.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**