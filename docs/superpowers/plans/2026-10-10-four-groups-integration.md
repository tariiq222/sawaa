# Four work groups integration plan

> **For agentic workers:** Use superpowers:executing-plans inline, then one independent whole-branch reviewer.

**Goal:** Merge the four owner-approved work groups into remote develop after resolving conflicts, correcting the audit and verifying the combined source.

**Architecture:** Preserve all seven branch tips through merge ancestry. Integrate auth, the combined booking branch, mobile design and the documentation branch into a task worktree based on origin/develop. Publish one reviewed PR into develop.

**Tech Stack:** pnpm 10.10.0, NestJS, Prisma, Next.js, Expo, Jest, Playwright, PostgreSQL, Redis, MinIO.

**Spec:** Owner request in chat 01a12664-d885-7ef1-aa63-e2deb4c15ef2; docs/operations/deployment-policy.md; docs/architecture/clinic-service-booking-contract.md.

## Global Constraints

- No main merge, production deployment, production data or shared database writes.
- Preserve unrelated dirty work and other active worktrees.
- Keep encryption AAD, secret defaults, migrations, VAT and role permissions unchanged.
- Required checks must pass on the final candidate; use synthetic disposable local infrastructure.
- Existing source and regression coverage are being integrated, not reimplemented. Any newly discovered behavioral fix requires a failing regression first.
- Merge develop through a PR without bypassing checks; retain ancestry of all requested branch tips.

## Review Focus

- Password rejection, missing identities, alias budgets and single-use admission must remain consistent.
- Cancelled draft cleanup must not remove paid, active or unresolved payment identity.
- Combined translation and payment-test changes must retain both mobile work groups.
- Home and detail must use the same timestamp; upcoming appointments must be future eligible appointments.
- Audit corrections must match current owning source and preserve the known chart monetary-unit defect.

### Task 1: Integrate source and correct documentation

**Files:** Existing branch changes in backend identity/bookings/finance, mobile screens/components/hooks/translations, generated OpenAPI/dashboard types, docs/audits/2026-10-08-dashboard-pages-audit.md and mobile release records.
**Interfaces:** Consume the four existing branch heads; produce a combined candidate preserving their Git ancestry and behavior.

- [ ] Install isolated dependencies and run focused existing baseline tests on origin/develop.
- [ ] Merge codex/auth-login-enumeration, codex/booking-flow-fixes-20261009, codex/mobile-design-fixes-20261009, docs/store-prep18-dashboard-audit in that order using git merge --no-ff; inspect each conflict before resolving.
- [ ] Retain the most recent known App Store monitor timestamp; do not restore an older observation.
- [ ] Correct the audit's isPublic claim, public-profile fields claim and UI halala exception against GetEmployeeHandler, mapEmployee, financial-report-page and TrendChart.
- [ ] Run git diff --check and assert every requested branch is an ancestor of HEAD.

### Task 2: Verify the integrated candidate

**Files:** Existing regression specs; private logs and synthetic fixture scripts outside versioned product source; regenerated API artifacts and dated integration release record.
**Interfaces:** Consume Task 1 source; produce reproducible command results tied to candidate tree and synthetic live flow evidence.

- [ ] Run changed backend specs plus related login/payment/booking consumers; backend build, typecheck and changed-file lint.
- [ ] Run mobile Jest with coverage, typecheck and lint.
- [ ] Run pnpm openapi:sync and inspect the generated diff; verify handwritten api-client drift and dashboard typecheck.
- [ ] Start isolated PostgreSQL/Redis/MinIO and candidate backend/dashboard; seed only synthetic records.
- [ ] Run official dashboard smoke with all fixtures required for every test and verify real login/logout behavior.
- [ ] Repeat the booking API/database/Moyasar test-key Sandbox acceptance against the integrated backend; no live keys.
- [ ] Record commands/results and remaining physical-device limitations; dispatch a read-only independent whole-branch review and resolve material findings with regression coverage.

### Task 3: Publish and merge develop

**Files:** PR description, Git branch history, dated integration release evidence.
**Interfaces:** Consume verified candidate and independent review; produce merged develop SHA with all branch ancestors retained.

- [ ] Commit scoped corrections/evidence, push the task branch, create and attach a PR targeting develop; reference PR182 as superseded by integrated corrected content.
- [ ] Wait for required GitHub checks; inspect every failure without bypassing it.
- [ ] Re-fetch develop before merging. If it moves, integrate and rerun checks appropriate to new content.
- [ ] Merge using a merge commit after all gates pass; verify seven branch tips are ancestors of origin/develop.
- [ ] Synchronize local develop only when it can preserve concurrent dirty work safely.
- [ ] Observe automatic staging/Apple runs and report their actual state separately from merge success; stop before production.
