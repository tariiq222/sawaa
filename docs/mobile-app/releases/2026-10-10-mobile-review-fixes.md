# Mobile review fixes — 2026-10-10

## Source and scope

The owner asked for a full review of the mobile app (Jev Review), then for findings 1–7 to be fixed in one new branch. Branch `fix/mobile-review-findings`, created from `origin/develop` at `e28a34a42`. Changes are uncommitted at the time of writing; nothing has been committed, pushed, merged, deployed or submitted.

- **Booking payment (`app/(client)/booking/payment.tsx`):** a server-created booking identity is kept in memory (scoped to user and draft) as soon as creation succeeds, client booking queries are invalidated, and a failed local resume save no longer strands the client or risks a second booking.
- **Zero amount:** `bank-transfer.tsx` passes the outstanding halalas amount and currency to the success screen; the payment screen hides a non-positive amount instead of showing "Pay 0.00".
- **Receipt upload (`bank-transfer.tsx`):** ref-based double-submit guard; errors show translated text only.
- **Package purchase loop (`app/(client)/packages/[id].tsx`, `return.tsx`):** a pending native purchase redirects to the return screen once per app session instead of on every visit; the record is still kept while payment may settle, and is cleared once the server reports a non-PENDING, unpaid status.
- **Copy (`i18n/ar.json`):** client-facing noun «حجز» replaced with «موعد» (imperative «احجز» kept); feminine-addressed imperatives unified to the file's dominant masculine form. Existing keys unchanged.
- **Rating:** `useRateBooking` invalidates all client booking resources; the rating screen shows translated errors only (409 also treated as duplicate).
- **Global error alerts (`services/query-client.ts`):** query and mutation failures without their own handler no longer show the server or Axios message (English). A request with no response shows the offline copy; other failures show `common.errorDescription` (loads) or the new `common.requestFailed` key (actions, added to `ar.json` and `en.json`).
- **Auth request bound (`services/api.ts`, owner-approved):** the bare refresh call and the stale-refresh revoke call now have the same 15 s timeout as the `api` instance, so a stalled network cannot hang every request waiting on the shared refresh.
- **Stale-session responses (`services/api.ts`, `services/query-client.ts`, owner-approved):** a successful response whose request belongs to an earlier session epoch (logout/login happened while it was in flight) is rejected with `CanceledError` instead of reaching callers; cancelled requests raise no global alert. Login flows already start their session before sending and treat a changed session as cancelled.

No backend, Moyasar, schema, migration, VAT, AAD, secret or role-permission change; token semantics and guards are unchanged.

## Checks

| Check | Result |
|---|---|
| Mobile `tsc --noEmit` | pass (after `prisma generate` in the fresh worktree) |
| Mobile jest (full) | 238 suites / 1814 tests pass (16 new) |
| ESLint on changed ts/tsx files | clean |
| Global error alert tests (`services/__tests__/query-client.test.ts`) | 4/4 pass; old home-cards expectation of the raw message updated |
| New package-redirect test fails without the fix | confirmed |
| Jev Review (changed slice) | correctness 6.4 → 8.0, reliability 7.0 → 8.0 |

## Not verified

No device or simulator run. Not exercised live: booking created while the local resume save fails, bank-transfer failure → retry amount, double tap on receipt upload, failed native package purchase → reopening the package, rating refresh of the appointments list, global error alert in airplane mode, logout then login as another user while a slow request is in flight, slow network during token refresh. These need a manual staging test before acceptance.
