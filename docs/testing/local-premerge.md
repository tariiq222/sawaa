# Local premerge check

`pnpm test:premerge` (Node 22.12 or newer, per `.nvmrc`) builds the backend, installs the matching Playwright Chromium if it is missing, starts a fresh isolated local stack, runs the Playwright smoke specs in `e2e/playwright/` and the existing website-to-staff booking journeys (`SW-B03`, `SW-D02`), then stops the stack. It records the exact candidate (HEAD, the staged tree and the working tree) and the results under `.e2e/premerge-*/acceptance.json`. Re-run it when the candidate changes. It is a local check, not a CI gate, and it does not replace staging acceptance, payment-provider or physical-device verification.

The stack uses the `premerge` port set (infrastructure on 55771/55772/55773, apps on 55200/55203/55205), so the default local-stack ports stay free. Premerge runs remove their Docker volumes on shutdown, and a failed shutdown fails the run.

`playwright.local.config.ts` fails closed unless `e2e/local/with-env.mjs` supplied the owned synthetic fixture, isolated database and fixed localhost origins. Every browser request except the three app origins goes to a closed proxy port, so external sites, other local services and literal IPs are unreachable. The Next apps start with every key from their ignored `.env*` files pinned, so checkout values cannot leak into the run.

To list or run the specs against a live stack started with `pnpm e2e:local:stack --port-set=premerge`:

```sh
node e2e/local/with-env.mjs .e2e/local-<run-id> pnpm --dir apps/dashboard exec node ../../scripts/run-playwright.cjs test --config ../../playwright.local.config.ts --list
```

All test data stays synthetic and local. Skips, `test.fixme`, conditional skips and weakened assertions are not allowed; the gate rejects skipped, flaky or missing smoke results.
