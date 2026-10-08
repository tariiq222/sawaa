# Mobile email ownership before account entry

Status: owner approved the design and written plan in chat with «ابدا» on 2026-10-06. Implemented locally on codex/mobile-email-entry; independent review findings are resolved and local acceptance evidence is recorded in docs/mobile-app/releases/2026-10-06-email-entry.md. Only disposable local migrations were applied. No provider configuration or deployment changed.

## Intent

A person entering an email must receive a real verification challenge and a clear next step. Prove ownership before disclosing whether an account exists. After a correct email code, enter an eligible verified account, complete a new customer registration, or prove the existing phone before enabling email login on an existing unverified customer account.

Current evidence: `RequestMobileLoginOtpHandler` silently skips unverified/unknown email; `RegisterMobileUserHandler` verifies only SMS; both mobile email-verification banners exclude CLIENT; the legacy verification endpoint is staff guarded. A text-only change cannot complete this journey.

## Scope and compatibility

- Add a separate `/mobile/auth/email-entry` flow. Keep legacy login/register/OTP routes and their four-digit codes unchanged for installed builds.
- New email-entry email and phone challenges use six digits, expire after 300 seconds and allow five wrong attempts. Codes are single use.
- A successfully verified email gives a separate, random 256-bit continuation secret, valid for at most 600 seconds; it is not an access token.
- New app login branches on email versus phone. Phone login retains its current contract. New app registration starts with email verification and then collects the existing required first name, last name and phone.
- The mobile flow holds secrets only in memory; never route query parameters, AsyncStorage, Redux persistence, analytics, or logs. Losing flow state requires restarting verification.
- Preserve guest booking and permitted post-auth redirects; preserve client/staff session namespaces and existing practitioner/super-admin eligibility rules.
- No automatic account merge, staff creation, production data rewrite, provider credential change, new dependency, JWT audience change, or guard weakening.
- Provider acceptance is not mailbox delivery. User text says the code was sent only after provider acceptance; explicit failure stays on the current step with retry instructions.

## User journey

1. Email form validates syntax and submits `request`.
2. `request` sends the same email-ownership template independently of account existence. It performs no account classification. Show six-digit entry, edit email, resend countdown, and use-phone alternative.
3. `verify` checks/consumes the code and only then classifies identity under database locks.
4. Outcomes:
   - `authenticated`: verified, active, unambiguous customer or eligible verified staff; existing token issuers provide native tokens.
   - `register`: no User or Client owns the email. Collect names and phone, and capture explicit privacy-policy consent.
   - `verify_phone`: active existing CLIENT with an unverified email and a consistent verified phone anchor. User manually enters their registered phone; do not disclose the stored phone.
   - `unavailable`: disabled/deleted/ambiguous identity, mismatched User/Client email or phone, unverified staff, or unsupported Client-only identity. Display a generic support/phone-login route and never create a replacement account.
5. `request-phone` validates the continuation and its allowed mode, binds submitted details and phone, and sends SMS. Wrong existing phone gets a generic nonmatching-details error, with no stored phone disclosure.
6. `verify-phone` revalidates all bound identity state and code atomically. For new registration, create User+Client together; for linking, mark the same existing User and Client email verified. Issue native client tokens in the same transaction.
7. In all modes, consume the flow exactly once. No account mutation occurs before phone verification, except isolated challenge state.

## Identity rules

Normalize with the existing `normalizeIdentifier` policy consistently across request, classification and finalization; do not introduce a second email canonicalization policy in this change. Resolve all case-insensitive canonical matches, not findFirst, across both User and Client including inactive/deleted records; multiple candidates fail closed. Existing unique constraints are case-sensitive. Add lower(email) unique indexes on User and nonempty, nondeleted Client.email only after a matching duplicate preflight passes. Preserve the existing Client index predicate deletedAt IS NULL so legacy contact reuse after soft deletion is unchanged. The stricter deleted-contact refusal applies only inside the new email-entry flow. Do not rewrite or deduplicate rows. A failing preflight blocks the migration and is reported for an owner decision. Validate indexes on disposable fixtures and check staging data before any deployment proposal. Final registration rechecks cross-table ownership; database uniqueness handles simultaneous same-table inserts. Row locks alone do not prevent absent-row races.

Existing verified CLIENT login requires active User, exactly one active/nondeleted linked Client, and no conflicting User/Client email owner. If Client.email is null, the verified User email can remain the login anchor, as in the legacy route; do not silently write contact data during login. If Client.email is populated and differs, fail closed. An explicit matching Client email with missing `emailVerified` does not override an already verified matching User anchor.

An unverified CLIENT phone-link requires both User.phoneVerifiedAt and Client.phoneVerified, identical nonempty phones, exactly one active linked Client, User.email equal to the proven email, and Client.email null or identical. Finalization sets User.emailVerifiedAt, Client.email and Client.emailVerified together. A populated different Client email cannot be overwritten.

The current model does not reliably distinguish an unfinished signup from an administratively disabled account. Therefore every inactive User is unavailable in this new flow. Do not implement RESUME_REGISTER or reactivate a pending record; preserve the existing legacy signup retry route separately.

New registration must find no User or Client with either proven email or submitted phone, including deleted/inactive records whose identifiers remain reserved. Existing phone ownership directs the person to phone login/support; it never adopts, merges, or overwrites the record. Force CLIENT role and isSuperAdmin false; write both email/phone verification timestamps and existing FULL account fields.

Bind continuation to identity id(s), normalized email/phone, role, isSuperAdmin and tokenVersion(s), activation/deletion and verification states, link, and exact User/Client updatedAt timestamps. Recheck after acquiring locks at finalization, so change-away-and-back or any intervening profile write requires restart. For eligible staff, reuse `isMobileStaffEligible` and `TokenService.issueTokenPair(..., tx, RefreshTokenSource.MOBILE)`; no unverified-staff enrollment in this flow.

## HTTP contract

All paths below are under `/api/v1/mobile/auth/email-entry`, JSON POST and `Cache-Control: no-store`. Return API-safe machine error codes; never return raw provider errors.

```ts
type NativeSession = {
  tokens: { accessToken: string; refreshToken: string };
  sessionKind: 'client' | 'staff';
};
type EmailChallenge = {
  challengeId: string; maskedEmail: string;
  expiresIn: 300; retryAfterSeconds: 60;
};
type EmailVerified =
  | ({ next: 'authenticated' } & NativeSession)
  | { next: 'register' | 'verify_phone'; continuationToken: string; email: string; expiresIn: 600 }
  | { next: 'unavailable' };
type PhoneChallenge = {
  phoneChallengeId: string; continuationToken: string; maskedPhone: string;
  expiresIn: number; retryAfterSeconds: 60;
};
// request: { email: string } -> EmailChallenge
// verify: { challengeId: string; code: string } -> EmailVerified
// request-phone: { continuationToken: string; phone: string;
//                  firstName?: string; lastName?: string; privacyAccepted?: true } -> PhoneChallenge
// resend-phone: { phoneChallengeId: string; continuationToken: string } -> PhoneChallenge
// verify-phone: { phoneChallengeId: string; continuationToken: string; code: string }
//               -> { next: 'authenticated' } & NativeSession
```

Names and privacyAccepted=true are required only in `register`; save Client.consentedAt and the existing PRIVACY_POLICY_VERSION server-side. The server rejects registration-only fields in a linking operation and derives identity exclusively from the continuation. Email cannot be supplied or overridden after verification. Phone challenge expiry is capped at the continuation's original expiry; resend never extends ownership proof lifetime. Each successful phone dispatch rotates the continuation secret and phoneChallengeId, invalidating earlier phone challenges. `request` performs email resend by creating a new challenge subject to the same limits.

Errors: malformed DTO 400; invalid/expired/exhausted proof 400 with `invalid_or_expired_code`; continuation mismatch 400 with `invalid_or_expired_flow`; occupied/mismatched registration or linking details 409 with `details_unavailable`; send cooldown/hour budget 429 with retry metadata; provider/dependency failure 503 with `delivery_unavailable`. Account status is never disclosed in pre-email-verification responses. Timing and error behavior before that point must not depend on account presence.

## Storage, sending and concurrency

Use one additive `MobileEmailFlow` PostgreSQL table to keep proof consumption, identity writes and refresh-token creation in a single transaction. No new OtpPurpose enum and no reuse of public OTP grants. Store bcrypt hashes of codes and SHA-256 hashes of high-entropy continuation secrets, not plaintext codes/tokens. No new encryption key.

Fields: UUID id, email, state, emailCodeHash, emailExpiresAt, emailAttempts, continuationHash (nullable unique), continuationExpiresAt, mode, boundUserId, boundClientId, identitySnapshot JSON, phone, firstName, lastName, privacyAcceptedAt, phoneMatchAttempts, phoneChallengeId (nullable unique), phoneCodeHash, phoneExpiresAt, phoneAttempts, createdAt, updatedAt, consumedAt. Add indexes on email/createdAt and expiry/consumption for retention. Nullable phase fields are validated against the state by the service; DTOs cannot set them. Enums: state EMAIL_SENDING, EMAIL_PENDING, DETAILS_PENDING, PHONE_SENDING, PHONE_PENDING, CONSUMED, FAILED; mode REGISTER, LINK_PHONE.

For both channels, persist the SENDING reservation before contacting the provider, without holding a database transaction across network I/O. Provider success transitions only the same reserved challenge/version to PENDING; failure transitions it to FAILED or safely restores the previous DETAILS_PENDING state without extending lifetime. A timeout is not success. Verification never accepts SENDING/FAILED state. Process death leaves an unusable expiring row, not a usable login grant. A lost success response requires resending/restarting, with visible mobile recovery.

Limit email and phone sends to one per 60 seconds and five per hour, globally per normalized identifier rather than per challenge, using atomic Redis reservations. Use hashed identifiers in Redis key names. Add IP throttles (request/request-phone/resend-phone: three per minute; verify/verify-phone: ten per minute) using existing shared throttler wiring. Account lookup does not influence email budget. Provider errors keep the short cooldown to avoid retry storms; do not burn the successful hourly send quota for a definitively rejected send. Treat ambiguous provider timeouts as attempted sends. Redis failure fails closed. Limit incorrect existing-phone guesses to five per continuation (commit the counter before returning an error); after exhaustion require a fresh email proof. All expiries are absolute and bounded to at most 900 seconds from flow creation.

Lock the flow row, then the bound User and Client rows in deterministic order, and re-read under lock. Incorrect-code attempt increments must commit (return an internal result and throw the HTTP error outside the transaction), as in existing OTP verification. Successful consumption and token creation must commit together; parallel correct submissions yield one session. Registration uniqueness is ultimately enforced by current User unique constraints and Client partial unique indexes; translate P2002 into a generic conflict and roll back every write. No write can retarget a continuation to another identity.

Cleanup removes only expired rows of this new table after a 24-hour grace period, in bounded batches under the existing cron leader mechanism. Clear code hashes on phase completion. Never log identifiers, codes, continuation secrets or tokens; log safe reason/status and random request id only.

## Mobile implementation

An email-entry screen handles email code, registration details, existing-phone prompt, and phone code with a small in-memory state machine. Extract forms to focused components below the 350-line project limit. Login email branch and Create account both navigate there with only nonsensitive booking/redirect context. Registration starts with an email form; after verifying it, email becomes read-only for the remaining flow.

Use Arabic and English keys, existing theme primitives, one native six-digit OTP input, paste/autofill, countdown derived from server expiry, accessible labels and duplicate-submit fencing. Back/edit email clears secrets and restarts. App process restart cannot resume a proof. Distinguish invalid code, expiry, send throttling, network/provider failure and identity unavailable. Always offer phone login or restart where appropriate.

Only a response containing authenticated native tokens calls existing session persistence. Capture the current session epoch and an independent flow-generation nonce before awaiting every branching request; verify both before promoting a token result to beginSession(), then retain existing epoch checks through persistence/profile load. Cancellation, restart, email edits, route abandonment and alternate phone login invalidate the flow generation. Suppress stale responses after logout, account change or leaving the flow. Fetch the matching profile before Redux credentials/navigation, preserving existing superseded-session protections and booking return decoding. Do not persist a continuation as an auth token.

## Acceptance and delivery boundaries

Prove request behavior independent of known/unknown email; no tokens/account mutation before proof; all four email outcomes; full new registration and phone-link success; provider failures; invalid/expired/reused codes; rate limits across new challenge ids; lost response recovery; replay/races; changed/deleted/disabled identities; occupied phone; User/Client divergence; staff/MFA rules; mobile session fencing and booking return; and unchanged old SMS/email API behavior.

Use synthetic local Postgres/Redis fixtures and fake EmailChannelAdapter/SmsChannelAdapter. No real third-party messages in automated tests. Run focused identity tests, real-DB concurrency/HTTP tests, mobile checks, OpenAPI generation and dashboard smoke before claiming implementation complete. Physical staging email/SMS delivery remains a separate manual verification after an authorized staging deployment.

Commit/push/merge/staging publication and TestFlight upload are separate from this implementation request under `docs/operations/deployment-policy.md`. This document authorizes none of those actions by itself. Production remains out of scope.
