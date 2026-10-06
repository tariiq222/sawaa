# Mobile email ownership entry implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real email code leads to an eligible account, safe phone verification, or explicit new registration without leaking account presence before proof.

**Architecture:** Add separate mobile email-entry endpoints and a transactional PostgreSQL flow record. Reuse existing provider adapters, identity normalization, native token issuers and mobile session fencing; retain old installed-app routes. Email proof is a short-lived continuation, never a session on its own for unverified/new identities.

**Tech Stack:** NestJS 11, Prisma 7/PostgreSQL, Redis, bcryptjs, Expo 55/React Native 0.83, Jest, Supertest.

**Spec:** [Approved intent and proposed detailed design](../specs/2026-10-06-mobile-email-entry-design.md).

## Global Constraints

- No automatic account merge, staff creation, production data rewrite, provider credential change, new dependency, JWT audience change, or guard weakening.
- New email-entry email and phone challenges use six digits, expire after 300 seconds and allow five wrong attempts. Codes are single use.
- A successfully verified email gives a separate, random 256-bit continuation secret, valid for at most 600 seconds; it is not an access token.
- No changes to legacy four-digit OTP/register/login contracts; preserve existing staff eligibility and native session namespaces.
- New writes force CLIENT role and synchronize User/Client proven contacts and verification fields.
- Mobile secrets remain in memory and every mobile source file stays below 350 lines.
- Migration additions only; no cleanup/backfill of existing identity rows. Duplicate preflight failure blocks migration, not permission to merge identities.
- All automated delivery tests use fake adapters and disposable local databases. Shared-environment writes and releases require the deployment-policy scope.

## Review Focus

1. A linked legacy Client has no email although its User does: permit safe linking after both proofs without overwriting another contact (Task 2).
2. A delayed successful email response arrives after logout/new login: no stale token/profile writes (Task 3).
3. Email/phone/role changes away and back while a continuation exists: snapshot timestamp mismatch forces restart (Task 2).
4. Two requests use the correct code concurrently or wrong attempts race: one success, committed bounded counters (Tasks 1, 2, 4).
5. Provider timeout/process failure/lost response during send: no usable unsent proof or endless spinner, safe restart with quota intact (Tasks 1, 3).

## Ownership and sequence

Current worktree `/Users/tariq/.codex/worktrees/payment-clarity/sawaa`, branch `codex/mobile-email-entry`, base `742c5d27392f0f55c87544771dffafc77339a367`. Main checkout dirty release notes remain untouched.

Task 1 precedes Task 2. Task 3 may run in parallel with Task 2 only after the DTO/response contract in the spec is frozen; it owns mobile files exclusively and mocks that contract. Parent owns Task 4, generation, integrated checks, docs and final review. Workers must not run full build/lint/test suites or mutate another lane. One independent reviewer inspects the integrated diff and concurrency evidence. Do not spawn child agents.

## Task 1: Isolated proof storage and delivery state

**Files:**
- Modify `apps/backend/prisma/schema/identity.prisma` (new model/enums only).
- Create a timestamped `apps/backend/prisma/migrations/<timestamp>_add_mobile_email_flow/migration.sql` and a separate additive canonical-email-index migration.
- Create `apps/backend/src/modules/identity/mobile-email-entry/mobile-email-flow.store.ts` and `.spec.ts`.
- Create `apps/backend/src/modules/identity/mobile-email-entry/mobile-email-send-limiter.ts` and `.spec.ts`.
- Create `apps/backend/src/modules/identity/mobile-email-entry/mobile-email-delivery.ts` and `.spec.ts`.
- Create `apps/backend/scripts/check-email-entry-duplicates.ts` (read-only, counts only).
- Modify `apps/backend/src/modules/ops/cron-tasks/data-retention.cron.ts` and its spec for bounded expiry cleanup of the new table.

**Interfaces:**
`MobileEmailFlowStore` owns transaction-scoped row locking and phase transitions, using the exact fields/states from the spec. `MobileEmailSendLimiter.reserve(channel, normalizedIdentifier)` returns an opaque reservation; `settle(reservation, 'accepted' | 'rejected' | 'unknown')` updates only that reservation. `MobileEmailDelivery.send(channel, identifier, code)` calls the existing channel registry; it never logs payloads or constructs provider clients.

- [ ] Add failure-focused tests first: expired proof, attempts persisted on failure, compare-and-consume once, illegal phase transition, atomic quota across different challenge IDs, Redis unavailable, and failed provider generation cannot invalidate a newer generation.

```ts
it('does not issue a proof from a sending or failed challenge', async () => {
  for (const state of ['EMAIL_SENDING', 'FAILED'] as const) {
    const challenge = await fixture.emailChallenge({ state });
    await expect(flow.verifyEmail(challenge.id, challenge.code))
      .rejects.toMatchObject({ response: { code: 'invalid_or_expired_code' } });
  }
});
it('resending cannot evade per-identifier limits', async () => {
  const first = await limiter.reserve('EMAIL', 'person@example.test');
  await limiter.settle(first, 'accepted');
  await expect(limiter.reserve('EMAIL', 'person@example.test'))
    .rejects.toMatchObject({ status: 429 });
});
```

`fixture` in unit tests uses the minimal Prisma/Redis mocks; real row locking is tested in Task 4, not asserted from mocks.

- [ ] Run only the new focused spec paths to record an expected red result, then implement. Parent runs this checkpoint; workers may request it.

```sh
pnpm --filter=backend test -- --runInBand mobile-email-flow.store.spec.ts mobile-email-send-limiter.spec.ts mobile-email-delivery.spec.ts
```

- [ ] Add the model, state enum and mode enum from the spec. Use nullable phase fields, unique continuationHash/phoneChallengeId, email+createdAt and expiry indexes. Create migrations without editing existing history. Canonical-index preflight queries match the index predicates and return only duplicate counts. Separate ownership classification still includes disabled/deleted identities for this new flow:

```sql
SELECT count(*) FROM (
  SELECT lower(email) FROM "User" GROUP BY lower(email) HAVING count(*) > 1
) collisions;
SELECT count(*) FROM (
  SELECT lower(email) FROM "Client" WHERE email IS NOT NULL AND email <> '' AND "deletedAt" IS NULL
  GROUP BY lower(email) HAVING count(*) > 1
) collisions;
CREATE UNIQUE INDEX "user_email_canonical_unique_idx" ON "User" (lower(email));
CREATE UNIQUE INDEX "client_email_canonical_unique_idx" ON "Client" (lower(email))
  WHERE email IS NOT NULL AND email <> '' AND "deletedAt" IS NULL;
```

Review index locking against the migration charter before a deployment; index installation fails safely if legacy data collides. Do not report row locks as absent-row uniqueness protection. The read-only checker also counts inconsistent cross-table ownership so it can be surfaced, never auto-fixed.

- [ ] Implement provider reservations outside DB transactions; EMAIL_SENDING/PHONE_SENDING are unverifiable. Hash codes with bcrypt, continuation secrets with SHA-256. Commit attempt increments before converting sentinel results into HTTP errors. Use exact bounded lifetimes and Redis limits from the spec.
- [ ] Extend retention with batches of at most 500 new flow ids whose final expiry is over 24 hours old; delete only those ids under the existing leader lock. Test it leaves active/recent flows alone.
- [ ] Re-run the focused specs and Prisma validation on local disposable configuration. Record results; no commit yet.

## Task 2: Identity classification and transactional endpoint handlers

**Files:**
- Create `apps/backend/src/modules/identity/mobile-email-entry/mobile-email-entry.dto.ts` and response DTOs.
- Create `request-email-entry.handler.ts`, `verify-email-entry.handler.ts`, `request-email-entry-phone.handler.ts`, `resend-email-entry-phone.handler.ts`, `verify-email-entry-phone.handler.ts` with colocated specs in that directory.
- Create `mobile-email-identity.ts` (canonical candidate classification and locked snapshots) with spec.
- Create `apps/backend/src/api/mobile/client/email-entry.controller.ts` with controller spec.
- Modify `apps/backend/src/modules/identity/identity.module.ts` exports/providers and `apps/backend/src/api/mobile/client/mobile-client.module.ts` controllers.

**Interfaces:** Exactly the five endpoint payloads and discriminated responses in the spec. Use `ClientTokenService.issueTokenPair(client, tx)` for client sessions, map `rawRefresh` to `refreshToken`; use existing `TokenService.issueTokenPair(user, claims, tx, RefreshTokenSource.MOBILE)` for eligible staff. Do not call the legacy generic public OTP verifier for this flow.

- [ ] Write table-driven classification tests before implementation for known verified, unknown, existing unverified, inactive/deleted, Client-only, legacy Client.email=null, mismatched Client.email, duplicate canonical identities and ineligible staff. Test pre-verification requests do not query identity tables.

```ts
it('sends an ownership challenge before looking up an account', async () => {
  await request.execute({ email: 'Person@example.test' });
  expect(emailAdapter.send).toHaveBeenCalled();
  expect(prisma.user.findMany).not.toHaveBeenCalled();
  expect(prisma.client.findMany).not.toHaveBeenCalled();
});
it('does not activate a disabled user after proving their mailbox', async () => {
  const proof = fixture.correctEmailCode({ userActive: false });
  expect(await verify.execute(proof.input)).toEqual({ next: 'unavailable' });
  expect(clientTokens.issueTokenPair).not.toHaveBeenCalled();
});
```

- [ ] Run new focused handler/controller specs to record red, then implement classification and delivery orchestration.
- [ ] Return machine errors from the spec, no-store headers and controller throttles. DTOs validate UUID identifiers, six numeric digits, bounded names, normalized valid phone/email, and registration-only privacy consent; no direct userId/clientId/role input.
- [ ] For email success, consume email proof before returning either a session or a freshly generated continuation secret. Unknown creates only a REGISTER flow. Existing unverified binds immutable User/Client snapshots and LINK_PHONE mode. Block inactive identities including pending legacy signup.
- [ ] For linking request, enforce exact existing phone, matching verified User/Client anchors, five committed phone-match attempts and no disclosure of stored phone. For registration, check both contact owners, bind names/phone/consent, but create no account before phone proof. Any names supplied for LINK_PHONE are rejected.
- [ ] Finalize under flow/User/Client locks. Compare all snapshot fields including updatedAt and versions, and re-check every ownership/eligibility condition. Consume proof, synchronize contacts/verification and create refresh session within one transaction. Catch P2002 outside transaction and return generic conflict.

```ts
it('fills only an empty linked Client email after both proofs', async () => {
  const f = await fixture.unverifiedLinkedAccount({ clientEmail: null });
  const result = await finishBothProofs(f);
  expect(result.sessionKind).toBe('client');
  expect(await fixture.readIdentity(f)).toMatchObject({
    userEmailVerified: true, clientEmail: f.email, clientEmailVerified: true,
  });
});
it('rejects identity changed away and back after the email proof', async () => {
  const f = await fixture.phonePendingFlow();
  await fixture.changePhoneAwayAndBack(f.userId);
  await expect(verifyPhone.execute(f.verifyInput)).rejects.toThrow();
  expect(await fixture.refreshCount(f)).toBe(0);
});
```

- [ ] Run focused handler/controller tests. Root records results and inspects the actual diff; independent reviewer checks security-sensitive cases before integrated acceptance.

## Task 3: Mobile email entry and safe session completion

**Files:**
- Create `apps/mobile/services/email-entry.ts` and `services/__tests__/email-entry.test.ts`.
- Create `apps/mobile/features/auth/email-entry-state.ts`, `email-entry-state.test.ts`, and `use-email-entry.ts`.
- Create `apps/mobile/app/(auth)/email-entry.tsx` and focused components under `apps/mobile/components/features/auth/email-entry/` for email, code, details and existing-phone forms.
- Create screen tests under `apps/mobile/app/__tests__/email-entry.test.tsx`.
- Modify `(auth)/login.tsx`, `(auth)/register.tsx` and their tests to enter the new flow without carrying secrets in params.
- Extract shared completion from `(auth)/otp-verify.tsx` into `apps/mobile/features/auth/complete-native-session.ts` with a focused spec; reuse it for old and new flows without changing token semantics.
- Modify `apps/mobile/i18n/ar.json` and `en.json`; add query mutation hooks alongside the email-entry feature hook without new Redux state.

**Interfaces:** Mirror backend discriminated union from the spec in `services/email-entry.ts`. The reducer holds email/code/details/phone/result states locally. Flow-generation nonce increments on restart/edit/exit. Session completion captures both generation and current session epoch before awaiting; only still-current authenticated results promote/persist a new native session.

- [ ] Write failing service/reducer/screen tests first. Cover each `next` result, six-digit paste/autofill, duplicate submit, expiry/resend, delivery failure, alternate phone login and booking return.

```ts
it('does not replace a newer session with a late email result', async () => {
  const pending = deferred<EmailVerified>();
  api.post.mockReturnValueOnce(pending.promise);
  const result = controller.verifyEmail('123456');
  controller.cancel();
  beginSession();
  pending.resolve({ next: 'authenticated', ...clientSession });
  await result;
  expect(persistSessionTokensAtEpoch).not.toHaveBeenCalled();
});
it('never navigates with a continuation secret', async () => {
  api.verify.mockResolvedValue({ next: 'verify_phone', continuationToken: 'secret', email: 'a@example.test', expiresIn: 600 });
  await submitEmailCode('123456');
  expect(screen.getByText('أدخل رقم جوالك المسجّل')).toBeTruthy();
  expect(router.push).not.toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ continuationToken: expect.anything() }) }));
});
```

- [ ] Parent runs focused red tests, then mobile worker implements against frozen mocks (no backend dependency while writing).
- [ ] Use single screen local state, existing theme primitives and translated messages. New registration asks email first; after proof names/phone and explicit privacy consent, with privacy policy link. Existing unverified route asks only registered phone. Six-digit native code input uses numeric keyboard/autofill and accessible label.
- [ ] Preserve network/provider/rate-limit errors distinctly without making claims about account existence before email proof. Cancellation/restart clears flow secrets. Remount without state starts from email. Submit and resend remain disabled during in-flight requests.
- [ ] Extract existing profile fetch/Redux update/booking redirect behavior without removing any epoch checks. Old four-digit SMS screen behavior remains unchanged; add a regression assertion.
- [ ] Parent runs focused mobile tests, then reviews diff and ensures no secret appears in route params, persistent stores or logs.

## Task 4: Real integration, generated contracts and evidence

**Files:**
- Create `apps/backend/test/e2e/auth/mobile-email-entry.real-e2e-spec.ts` using the existing real-E2E helper and fake channel adapters.
- Modify `apps/backend/package.json` critical-real-e2e required list to include the new suite in both runner and required-results assertions.
- Generate `apps/backend/openapi.json` and `apps/dashboard/lib/types/api.generated.ts` with `pnpm openapi:sync`.
- `packages/api-client` currently has no mobile login/register endpoint; verify that remains true and do not invent an unrelated website consumer. If a mobile consumer is found, update it manually with matching types and tests.
- Create `docs/mobile-app/releases/2026-10-06-email-entry.md`; update the latest status in the worktree's `docs/mobile-app/README.md`, preserving previous TestFlight delivery evidence.

- [ ] Start disposable local Postgres/Redis with synthetic identities, apply additive migrations and run duplicate preflight. Never use shared environment credentials. Test a dirty duplicate fixture blocks canonical-index installation without data changes.
- [ ] Build the real HTTP suite using fake EmailChannelAdapter/SmsChannelAdapter; capture codes in test memory only. Exercise request → verify-email → request-phone → verify-phone → real profile GET.
- [ ] Run five simultaneous correct email requests and five correct phone verifications. Assert exactly one success and one refresh record. Race five wrong-code requests and ensure committed attempts reach the cap. Verify resend invalidates old code/challenge/token and does not extend original proof deadline.

```ts
const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => verifyPhone(input)));
expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
expect(await prisma.clientRefreshToken.count({ where: { clientId } })).toBe(1);
```

- [ ] Verify known/unknown email pre-proof response shape, phase transition errors, disabled staff/MFA rules, null-versus-different Client email, phone occupied by another account, case collisions, snapshot changes, no tokens before both proofs, consent fields, lost response restart, retained legacy phone and email flows, and no provider calls outside mocks.
- [ ] Root runs appropriate final validation once after integration, widening only on failures/changes:

```sh
pnpm --filter=backend test -- --runInBand mobile-email-entry request-mobile-login-otp register-mobile-user verify-mobile-otp native-session
pnpm --filter=backend typecheck
pnpm --filter=backend build
pnpm --filter=backend exec jest --config test/jest-e2e.json --runInBand --runTestsByPath test/e2e/auth/mobile-email-entry.real-e2e-spec.ts test/e2e/auth/mobile-client-identity.real-e2e-spec.ts test/e2e/auth/native-session.real-e2e-spec.ts test/e2e/auth/single-use-token-race.real-e2e-spec.ts
pnpm --dir apps/mobile test -- --runInBand
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile lint
pnpm openapi:sync
pnpm --filter=dashboard typecheck
pnpm --filter=dashboard run e2e:smoke
git diff --check
```

Set `REAL_E2E_DATABASE_URL` only to an isolated test database through the existing helper; never embed credentials in command history/evidence. After an authorized commit, verify migration history with `node scripts/check-prisma-migration-immutability.mjs origin/develop`; this script compares committed HEAD only. Before commit, separately inspect `git diff --name-status origin/develop -- apps/backend/prisma/migrations/` plus untracked migration paths and require only additions.

- [ ] Independent reviewer reviews actual diff and concurrency evidence. Root fixes actionable findings and reruns affected checks. Record exact branch, changed paths, checks/counts, unverified real email/SMS delivery and absent new build/deploy IDs.
- [ ] Complete local implementation handoff. No commit/push/merge/deploy/TestFlight upload until covered by the user's release authorization for this change. Do not modify existing dirty main-checkout release files during synchronization.

## Planning review record

Independent native Astra high review completed read-only. Incorporated: User/Client null-email compatibility, two-phase mobile stale-response fence, canonical uniqueness preflight, updatedAt snapshots, phone-guess caps, fixed lifetime, retention, committed failure counters and explicit consent. Final review caught and corrected a compatibility regression: the canonical Client email index retains deletedAt IS NULL, preserving legacy contact reuse after soft deletion; new-flow deleted-contact refusal stays scoped to its handlers. Deliberately excluded unsafe reactivation of inactive legacy signup records because there is no reliable origin marker.

Routing policy `astra-effort-v1`: coordinator baseline was captured after initial planning began; receipt attachment failed on an existing ledger `KeyError: participants`. Whole-task token attribution remains unknown; no quota-saving claim. This instrumentation fault does not affect product code or auth behavior.

## Execution record — 2026-10-06

Tasks 1–4 implemented and integrated locally on `codex/mobile-email-entry`; no commit or remote changes. The step-level boxes above remain the original planned sequence, not claims that every supplemental test was authored first. Lane reports record actual RED/GREEN sequence and later characterization tests.

- [x] Proof storage, two additive migrations, duplicate preflight, transactional failure counters, retention and delivery classification.
- [x] Five additive identity endpoints, compatible legacy routes, unchanged JWT namespaces and staff MFA eligibility.
- [x] Mobile local flow, explicit registration consent, phone validation, safe failure copy, booking continuation and stale-session fences.
- [x] Disposable real PostgreSQL/Redis acceptance: original four suites50tests; final new suite25tests including MFA. Index duplicate probes roll back atomically; local preflight allzero.
- [x] Backend full suite8,724pass1skip before review fixes; final affected14suites94pass and email-adapter9suites38pass; build/types/lint checks pass. Mobile final185suites1,313pass, typespass, lint0errors5existingwarnings. Dashboard smoke41pass1skip and typespass.
- [x] Independent review: twoP2 findings fixed and closed on actual diff, no higherseverity finding substantiated. Reviewed existing transaction wrapper convention fix too.
- [x] OpenAPI regeneration and coverage passed; exactly five additive paths and no existing path changed.
- [ ] Staging provider delivery/device acceptance and release (outside current implementation authorization).

No existing migration was edited. `packages/api-client` has no consumer for these mobile auth routes; mobile owns its typed service, while OpenAPI and dashboard generated types are regenerated. Manual physical delivery and new Apple build remain unverified. Evidence and release boundary: `docs/mobile-app/releases/2026-10-06-email-entry.md`.
