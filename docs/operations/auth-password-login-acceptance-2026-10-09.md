# Password login hardening — local acceptance, 2026-10-09

## Scope and revision

- Task branch: `codex/auth-login-enumeration`.
- Implementation and regression tests: `34403109a` (`fix(auth): harden password login against account enumeration`).
- Existing duplication refactor: `95ae5c85f`, on `refactor/backend-duplication-credits-chat-invoices`. It is separate work, already committed; it is not included in this auth branch.
- Local commits only. No push, merge or deployment was performed.

## Changes

- Generic `401 — Invalid credentials` for rejected password credentials across client, mobile and staff login; malformed input remains a request-shape error.
- Cost-12 dummy bcrypt verification for unknown, inactive, passwordless and locked accounts. The dummy comparison can never authenticate.
- Client/mobile admission counts the identifier and IP before identity lookup, independently of account existence. Exhausted shared admission rejects before database lookup or bcrypt.
- Single-use receipts bind mobile delegation to the exact Redis connection and IP. Stored counts remain authoritative; replay, forgery and mutated receipt fields cannot bypass admission.
- Verified-email aliases retain the canonical client identifier budget without counting the IP twice. Delegated admission rejection performs a dummy comparison.
- Existing identity/contact restrictions, expected client ID, persistent lockouts, 2FA and token behavior remain intact.

This reduces the large bcrypt/no-bcrypt timing oracle; it does **not** establish strict constant-time behavior or eliminate every possible account-discovery surface.

## Automated verification

Before the implementation commit, these checks passed again from `apps/backend` with project pnpm 10.10.0:

```bash
node --require ../../auth-test-env.cjs ../../node_modules/jest/bin/jest.js \
  --runInBand \
  src/modules/identity/client-auth/client-login.handler.spec.ts \
  src/modules/identity/mobile-password-login/mobile-password-login.handler.spec.ts \
  src/modules/identity/login/login.handler.spec.ts \
  src/modules/identity/shared/password-login-security.spec.ts

pnpm exec eslint \
  src/modules/identity/client-auth/client-login.handler{,.spec}.ts \
  src/modules/identity/mobile-password-login/mobile-password-login.handler{,.spec}.ts \
  src/modules/identity/login/login.handler{,.spec}.ts \
  src/modules/identity/shared/password-login-security{,.spec}.ts

pnpm exec tsc --noEmit
```

Results: **4 suites / 87 tests passed**, targeted ESLint passed, TypeScript passed. The preload is a local-only isolated test environment and is intentionally not committed; the command above is a record of execution, not a self-contained reproduction recipe. Do not substitute live credentials.

Earlier verification of the same implementation content passed:

- Full backend Jest run: 922 suites / 9,141 tests passed; one suite / one test skipped.
- Backend build and targeted ESLint.
- 37 real HTTP acceptance checks against isolated infrastructure.
- `pnpm openapi:sync`: no snapshot or generated dashboard type changes.

`git diff --check` passed. The implementation commit's pre-commit backend ESLint and legacy multi-tenant guard both passed. The first commit attempt stopped because the shell selected pnpm 11.7.0; retrying with the installed project pnpm 10.10.0 succeeded without bypassing hooks.

## Focused dashboard browser acceptance

The dashboard used port 55005 and the backend port 55004, backed by isolated Postgres, Redis and MinIO. Test accounts were synthetic and retained. The following observations are corroborated by backend request logs; times are Asia/Riyadh:

| Case | Observed result |
|---|---|
| Wrong password for the exact test identifier | Login `401`, `Invalid credentials`, stayed on login; 21:13:49 |
| Edit password field | Error cleared before resubmission |
| Correct password | Login `200`, dashboard identity `Isolated Auth Staff`, dashboard stats `200`; 21:14:11 |
| Logout | `200`, returned to login; 21:14:27 |
| Open protected root and refresh after logout | Login remained visible; refresh `401 — No refresh token`; 21:14:46 |

An earlier failed "correct password" attempt sent a different email identifier. Inspection of the actual request identified the input error; repeating with the intended identifier succeeded. No account password change or manual lock/counter reset was needed.

## Evidence boundaries and remaining checks

- This was focused live browser acceptance, **not** a full execution of the official dashboard `e2e:smoke` suite or backend `test:e2e` suite. Those suites remain unrun for this task.
- A screenshot labeled as the wrong-password state did not visibly contain the alert on review. It is not used as visual proof of that alert. The rejected request, server response and browser worker observation support the result.
- Browser screenshots and local acceptance scripts remain outside the commits. The scripts contain local fixture configuration, not deployable application configuration.
- The pre-existing staff Redis fallback, successful-login IP budget clearing, and per-contact budget behavior were not broadened into this task.
- During backend cancellation, the known Redis shutdown error `Connection is closed` recurred. Shutdown was not clean; fixing that lifecycle issue is outside this change.

Both temporary application ports were verified closed after cancellation. Infrastructure containers and fixtures were retained; no database reset or destructive cleanup was performed. Other contributors' mobile documentation changes were left untouched.
