# Paid-program checkout repair — validation record

Implementation is complete locally and the local checks below passed. Real Moyasar payment and physical-device acceptance remain blocked/unverified; this is not staging or production readiness.

Worktree: `/Users/tariq/.codex/worktrees/sawaa-program-checkout/sawaa`
Base: `95cab4d05`. Uncommitted changes; no push, merge or deployment. The original dirty checkout was preserved.

## Resulting behavior

- Paid program enrollment opens checkout for the existing booking and invoice. It no longer announces success before payment. Free confirmed enrollment retains immediate confirmation.
- The authenticated mobile enrollment endpoint is now `POST /api/v1/mobile/client/programs/:id/enroll`. It reuses the existing client-session guard; browser CSRF, authentication and authorization policies were not changed. The former public website endpoint rejected native bearer requests with `CSRF_INVALID`.
- Repeat enrollment is resolved under the program row lock before capacity checks. It reuses the same active booking/invoice, including when full, without another seat, counter increment, minimum-participants event or extended payment deadline. Historical booked price controls invoice consistency.
- Checkout uses the authoritative invoice amount and binds its invoice ID to the authenticated booking. Only a paid invoice together with a confirmed/completed booking produces success. Pending, partial, missing/mismatched, failed, cancelled and expired states have separate handling.
- Payment retry/reopening uses the existing invoice; appointment detail offers payment recovery. Same-frame duplicate taps, stale responses, app foreground rechecks and bounded polling are covered.
- A fixed website callback returns to `sawa://booking/payment-callback`. Callback parameters transport IDs only; they never prove payment. Website-only callback behavior remains supported.
- Payment initialization rejects an expired program hold. New Moyasar hosted invoices receive the same `expired_at` deadline ([Moyasar API](https://docs.moyasar.com/api/invoices/01-create-invoice)). Previously-created hosted invoices retain their original provider configuration.
- The mobile booking adapter now consumes the actual nested invoice/date/time response, preserves Riyadh time and hides the unscheduled year-2999 sentinel.
- A narrow Metro patch reads image bytes for the existing image-size 2.0.4 API. It fixes fresh-install bundling while retaining the security-pinned version; no package versions were changed.

## Verification

| Check | Observed result |
|---|---|
| Root/mobile frozen dependency installs; shared build; Prisma generation | Passed |
| Backend build after new native endpoint | Passed |
| Backend selected regression | 10 files, 222 passed, 0 failed/skipped |
| Final mobile enrollment/payment controller regression | 2 files, 17 passed, 0 failed/skipped; includes 3 new enrollment tests and 14 overlapping payment-controller tests |
| Real PostgreSQL concurrency/payment integration | 3 files, 11 passed, 0 failed/skipped |
| Updated program real-DB test after native endpoint addition | 1 file/test passed; now also proves unauthenticated HTTP 401 and authenticated bearer enrollment without CSRF, reusing the original booking/invoice |
| Website callback + booking API | 2 files, 19 passed, 0 failed/skipped |
| Website typecheck | Passed |
| Final full mobile Jest suite | 34 files, 192 passed, 0 failed/skipped |
| Final mobile typecheck | Passed |
| OpenAPI sync | Passed; snapshot and dashboard types contain only the new endpoint addition. No affected consumer in the handwritten API client |
| Dashboard full smoke | 41 passed, 1 skipped, 0 failed/flaky; conversation test skipped because `WEB_CHAT_ENABLED=false` |
| Final affected dashboard smoke after endpoint addition | 8 passed, 0 failed/skipped/flaky: setup, booking mutations, home render/reload and program edit |
| Changed-source lint | Backend and website passed; mobile 0 errors, 2 pre-existing appointment hook-dependency warnings |
| iOS Expo export | Passed; bundle generation, not an installed-device test |
| Actual Expo web + local backend UI | 7 checks passed: paid enrollment opens checkout, unpaid is not success, reload preserves invoice, init uses original invoice, no extra individual booking, appointment resumes same invoice, no sentinel date |
| Independent integrated Astra review | No material findings established; code review only |
| `git diff --check` | Passed |

The real-DB harness uses the new migrated PostgreSQL database `sawaa_program_checkout_test_20260922`. Its Redis/BullMQ and external providers are mocked; it proves database/concurrency behavior, not gateway payment. Dashboard and Expo web checks use the actual local backend, separate Redis and synthetic records.

In the UI probe, payment initialization reached the correct invoice but returned HTTP **409** because the isolated environment has no Moyasar credentials and the handler could not reconcile the payment attempt. The probe did not reach hosted payment or record a successful charge. The checks above must not be described as a complete real-payment E2E.

## Evidence and reproduction

Durable local evidence: `.superpowers/sdd/2026-09-22-program-checkout/evidence/` (ignored, contains logs, test JSON, screenshot and temporary probe/fixture sources). Per-task briefs, reports, progress ledger and independent review are in the parent directory. These files contain no copied provider credentials or test-session tokens.

Key commands run from the worktree:

```sh
pnpm --dir apps/backend build
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile exec jest --runInBand
API_URL=http://localhost:35560 pnpm openapi:sync
pnpm --dir apps/mobile exec expo export --platform ios --output-dir /tmp/sawaa-program-ios-export-final
```

Backend focused tests, real-DB prerequisites and dashboard custom-port probe configuration are retained with the evidence. Temporary fixtures/probe files were moved out of application source directories after validation. Synthetic database and worktree are preserved.

## Remaining acceptance gates

1. The sandbox key configured in the original local environment returned HTTP **401** on a read-only authenticated Moyasar request. No live key was used and no payment was created. Valid sandbox configuration is needed for successful/declined payment, real callback/webhook delivery and cancellation/reopen verification.
2. Installed iOS/device return, cold-start deep link and Apple Pay availability/payment are unverified. Expo web, Jest and iOS bundle export do not establish those results.
3. Staging deployment and the owner's acceptance test have not occurred. Production is not authorized.

Next acceptance sequence once sandbox is configured: create one synthetic paid program registration; complete a sandbox payment; verify one invoice/payment/seat and confirmed booking; exercise decline, browser cancellation, reopen, delayed callback and expiry; then repeat the native return flow on an installed iOS build and verify Apple Pay on a supported device/configuration.
