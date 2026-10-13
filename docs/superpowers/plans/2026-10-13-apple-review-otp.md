# Apple reviewer OTP implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, then a fresh GPT-6.1 Sol reviewer. Preserve unrelated changes; no deployment is implicit in implementation.

**Goal:** Let the existing synthetic Apple client use a fixed four-digit login OTP and its existing password login.

**Architecture:** Keep the existing OTP lifecycle: request cooldown, hourly cap, bcrypt comparison, failed attempts, expiry and single consumption. A disabled-by-default identity handler supplies a private configured hash only for the configured standalone synthetic client and EMAIL/MOBILE_LOGIN. Recheck eligibility inside verification's locked transaction before issuing the existing client token pair.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis, bcrypt, Jest.

**Spec:** Owner's approvals in this chat: fixed OTP for review account only; both OTP and email/password login. Existing review account must remain standalone, hidden, and unrelated to real clients or appointments.

## Global Constraints

- Exact configured client ID and `apple@review.sawaa.invalid`; active, undeleted, email verified, password set, no phone or linked User, no conflicting User email.
- Private bcrypt hash and absolute retirement time; missing, malformed or expired configuration disables the feature.
- Four-digit existing legacy endpoint only; registration, reset, SMS and real customer/staff flows retain their behavior.
- Never commit OTP/password/hash, expose code in API responses, contact providers for review OTP, change guards/token namespaces, or migrate data.
- Work in `codex/apple-review-otp`; preserve owner's local develop and submission documents.
- Production requires owner-accepted staging SHA and explicit production release under deployment policy. Apple gets credentials only after live verification.

## Review Focus

- Synthetic identity changes between initial lookup and locked verification must deny login.
- Retired/rotated configuration must deny leftover OTP rows.
- Wrong codes must commit attempts and lockout without issuing tokens.
- Concurrent verification must consume one challenge only.
- Existing email/password review login and normal user OTP must remain functional.

### Task 1: Scoped reviewer challenge across request and verification

**Files:** Add `modules/identity/review-otp/review-otp.handler.ts` and integrated handler spec; modify identity module, request-mobile-login-otp, request-otp, verify-mobile-otp, env validation/example and their regression fixtures; add real HTTP review OTP spec.

**Interfaces:** `ReviewOtpHandler.execute({ identifier, channel, purpose }, db?)` returns eligible client, bcrypt hash and retirement time or null. Consumers reuse the existing request and verification endpoints. No public DTO or endpoint is added.

- [ ] Write integrated regression first: `await requestLogin.execute({identifier: reviewEmail}); expect(state.otp).toBeDefined(); await expect(verify.execute({identifier:reviewEmail,code:fixtureCode,purpose:LOGIN})).resolves.toMatchObject({sessionKind:'client'})`.
- [ ] Run `pnpm --filter=backend exec jest --runInBand src/modules/identity/review-otp/review-otp.handler.spec.ts`; expected missing challenge/assertion failure against current handlers.
- [ ] Implement `ReviewOtpHandler` eligibility and inject it into the three handlers. Request stores its hash, clamps challenge expiry to retirement and skips provider delivery. Verification rechecks locked synthetic identity/current hash, then follows ordinary OTP attempt/consumption/client-token logic.
- [ ] Add table cases for absent/malformed/retired configuration, linked/disabled/deleted/unverified/wrong identity, staff collision, wrong codes/attempt lockout, consumed/expired challenge, cooldown/hourly cap, SMS/reset/register exclusions and normal delivery.
- [ ] Run focused auth specs plus backend typecheck; expected all pass, no compile errors.
- [ ] Add and run real HTTP PostgreSQL/Redis coverage for fixed OTP success, wrong code attempt persistence, replay/concurrent denial, password login, purpose and identity exclusions. Use disposable local stack only, external email/SMS adapters replaced.
- [ ] Score coherent implementation with Jev, inspect weak important metrics and improve only justified gaps, then rescore after meaningful changes.
- [ ] Fresh independent Sol reviewer inspects working diff and tests. Fix important findings using failing regression first.
- [ ] Run applicable final checks and `git diff --check`; `pnpm test:premerge` before any authorized merge. Preserve logs and exact candidate evidence. Publication, manual staging acceptance and production activation remain separate gates.

## Execution decisions

Inline because the request, persisted challenge and verification share one identity contract. Existing owner approval covers the bounded design and execution; do not ask the user to choose a workflow again. No commits are required by this plan before publication is explicitly in scope.
