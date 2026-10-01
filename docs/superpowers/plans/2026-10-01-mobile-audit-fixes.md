# Mobile audit fixes implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Fix guest-home route ambiguity and missing booked-service identity, then remediate compatible outstanding dependency advisories.
**Architecture:** Use explicit public route destinations while retaining role routing in the existing guest HomeRoute. Render booked service identity from existing normalized snapshot fields with language fallback. Apply narrow dependency constraints only after a compatibility review.
**Tech Stack:** Expo Router 55, React Native 0.83, Jest, pnpm 10.10.0.
**Spec:** Owner-authorized findings in /tmp/sawaa-branches-audit-20261001/acceptance.json and docs/architecture/clinic-service-booking-contract.md.

## Global Constraints
- Starting HEAD: 5172887e65afa4dc6d512750caa808c28aad19ab.
- No commits, pushes, merges, deployments, branch deletion or PR closure authorized by this task.
- Preserve original checkout's two dirty mobile release documents; append current local evidence in isolated checkout docs at completion.
- Do not change guards, tokens, session epoch/fence, auth state or backend contracts; change navigation destinations only.
- Public entry and logout destination: /(guest)/home; retain client/staff redirection already owned by the guest HomeRoute.
- Appointment labels use existing normalized serviceNameAr/serviceName and legacy service.nameAr/nameEn. Do not infer identity from department names or introduce backend lookups.
- Root owns package manifests/lockfiles, docs and integrated validation. Workers have disjoint source ownership, no children, no builds/lint/full test suites. Explicitly permitted focused RED/GREEN tests only.
- Astra workers/reviewers medium effort; independent packages run in parallel under project delegation policy (overrides SDD's generic serial-implementation rule). Uncommitted diff packages replace commit-based review packages.

## Review Focus
1. Guest login escape must resolve to guest group rather than a client guard.
2. Signed-in client and staff fallback must still reach their existing role tab shell.
3. Logout during hydration must not restore stale credentials; do not edit that mechanism.
4. Arabic/English service identity must survive missing preferred-language and legacy nested-only data.
5. Dependency patch constraints must preserve package APIs and independently locked mobile workspace.

### Task 1: Public navigation destinations
**Files:** apps/mobile/lib/navigation.ts; app/index.tsx; app/(auth)/login.tsx and suspended.tsx; client/profile.tsx; employee/(tabs)/profile.tsx; their navigation/escape tests; optional app/home.tsx compatibility redirect.
**Interfaces:** existing goBackOrHome signature unchanged; consumes existing guest role-dispatch HomeRoute, produces explicit public href.
- [x] Add a route-resolution/guest-escape regression and update public fallback assertions; assert actual consumer navigation result, not source text.
- [x] Run only named focused tests, capture expected RED before changing production source.
- [x] Change public callers/default fallback to /(guest)/home, preserve explicit role targets and history-back behavior; optional lightweight legacy /home redirect may restore old deep-link compatibility without duplicating hydration.
- [x] Run covering focused tests GREEN; report changed files, commands, RED/GREEN evidence and edge cases; do not commit.

### Task 2: Appointment service identity
**Files:** app/(client)/appointment/[id].tsx; components/features/appointments/AppointmentRowCard.tsx; local helper lib/booking-service-name.ts if necessary; component/helper tests.
**Interfaces:** consumes ClientBookingRow only; does not edit service type/normalizer or Task 1 navigation files.
- [x] Add failing screen/card tests for two differently named services under the same practitioner, language fallback and nested legacy payload; show no invented label when all names absent.
- [x] Run only named focused tests RED.
- [x] Display the normalized booked service name in detail and list with opposite-language fallback; use snapshots already present on normalized rows first, nested legacy names second; preserve existing presentation tokens and layout.
- [x] Run covering focused tests GREEN; no commit.

### Task 3: Dependency remediation and integrated verification
**Files:** root/package manifests and pnpm-lock.yaml; mobile manifest/lock only if independent audit needs fixes; docs/mobile-app/release records; this plan.
**Interfaces:** does not change worker-owned source; consumes scanner advisory/path inventory.
- [x] Capture pnpm audit JSON for root and mobile; independently inspect callers/compatibility before changing constraints.
- [x] Prefer patched versions inside existing major/API contracts; investigate any unavoidable major dependency jump and verify actual consumer API before choosing it.
- [x] Regenerate lockfiles using pnpm; install frozen locks; run both audits at low threshold and report all remaining advisories without blanket-safe claims.
- [x] Review each source task diff and complete integrated mobile tests/types/lint, root tests/types/build/dashboard smoke as required by changed dependencies. Use isolated test data; no live credentials or provider writes.
- [x] Run one fresh read-only final review over actual complete diff; resolve confirmed findings, repeat only covering checks after amendments.
- [x] Update local dated docs with exact checks and delivery boundaries. Keep all modifications uncommitted for owner review.

## Verification boundary
- [x] Full39phase run completed and all failures investigated; covering mobile rechecks pass after reviewed amendments.
- [ ] Current Trivy scan completes successfully. Blocked by external database transport: first download timeout, one official-GHCR retry unexpectedEOF. No full39/39 or release acceptance claimed.
