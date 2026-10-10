# Package catalog ↔ balance navigation loop — 2026-10-11

## Change

The package catalog (`app/(client)/packages/index.tsx`, «رصيد الباقات» entry) and the package balance (`app/(client)/packages/purchases.tsx`, «تصفح الباقات المتاحة» entry) linked to each other with `router.push`. Each tap stacked another copy of the screen, so the back button walked through every copy before leaving the section.

Both entries now call `openOrReturnTo` (`lib/navigation.ts`): when the target is the screen directly below in the `(client)` stack, the app pops back to it with `router.back()`; otherwise it pushes as before. Other entry points (home balance card, account tab) are unchanged.

## Git state

Committed on branch `fix/mobile-packages-nav-loop` (from `develop`). Not pushed or deployed.

## Checks

| Check | Result |
|---|---|
| `jest balance-entry package-ui navigation.test account-tab return.test` | 6 suites / 65 tests passed |
| `tsc --noEmit -p apps/mobile` | exit 0 |

New tests: `openOrReturnTo` unit cases in `lib/__tests__/navigation.test.ts`, and a catalog test that pops back to the balance when it is the previous screen.

## Not verified

Live device flow not verified. The simulator (`Sawaa Booking QA`) was running a stale bundle; after relaunching it on the local Metro bundle the session was signed out, and sign-in was not possible because the local backend was not running. The catalog → balance → catalog → back sequence still needs a manual run on a signed-in build.
