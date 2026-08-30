# Browser lab baseline

Independent Playwright navigation baseline for the public website and dashboard.
It does **not** change `apps/dashboard/playwright.config.ts` or website config.

Playwright is resolved from `apps/dashboard` (`@playwright/test`).

## Command (repo root)

```bash
node quality/performance/browser/baseline.mjs --help
node quality/performance/browser/baseline.mjs --self-test
node quality/performance/browser/baseline.mjs
```

Optional output file:

```bash
PERF_OUTPUT=quality/performance/browser/baseline.json \
  node quality/performance/browser/baseline.mjs
```

Install browsers once (dashboard Playwright, not a new package):

```bash
pnpm --filter=dashboard run e2e:install
```

## Defaults (local only)

| App | Default URL | Dev / start port |
|-----|-------------|------------------|
| Website | `http://localhost:5205/` | 5205 |
| Dashboard | `http://localhost:5203/` | 5203 |

Override with JSON or CSV:

```bash
PERF_URLS='["http://localhost:5205/","http://localhost:5203/login"]' \
  node quality/performance/browser/baseline.mjs

PERF_URLS='http://localhost:5205/,http://localhost:5203/' \
  node quality/performance/browser/baseline.mjs
```

CLI flags: `--urls`, `--output`, `--storage-state`, `--wait-ms`, `--timeout-ms`, `--confirm-remote`, `--self-test`.

## Self-test (no browser)

Read-only checks for the remote/redirect guard, UUID/query/JWT redaction,
CLS session windows, and deterministic event-row ordering. Does not launch
Playwright or touch the network:

```bash
node quality/performance/browser/baseline.mjs --self-test
```

## Measure production builds, not `next dev`

Turbopack/dev compiles routes on demand and inflates TTFB/LCP. For a lab
baseline, start production servers first:

```bash
pnpm --filter=@sawaa/website build && pnpm --filter=@sawaa/website start
pnpm --filter=dashboard build && pnpm --filter=dashboard start
```

Website `start` listens on 5205. Dashboard `start` uses `PORT=5203` (see
dashboard Playwright comments). Keep the backend up if the pages fetch API data.

This script never starts those servers.

## Dashboard auth (`storageState`)

The public website can be measured anonymously. Dashboard routes usually
redirect to login without a session.

Reuse the dashboard e2e persona files (created by `apps/dashboard/e2e/setup`):

```bash
PERF_STORAGE_STATE=apps/dashboard/playwright/.auth/admin.json \
  PERF_URLS='http://localhost:5203/' \
  node quality/performance/browser/baseline.mjs
```

Generate them with the dashboard Playwright setup project, not this tool.
The report only records `storageStateProvided: true|false`. It never writes
cookies, tokens, or headers.

## Cold vs warm

Each process launch is one pass over the URL list (one navigation per URL).

- **Cold:** new process, or restart the browser between runs. First hit after
  `next start` includes server/module warmup.
- **Warm:** run the same command again against the already-running production
  servers without restarting Node.

Do not compare a cold dashboard login redirect with a warm authenticated home.

`--wait-ms` (default 5000, env `PERF_WAIT_MS`) is the extra observe window
after `load` so LCP/CLS can settle. It is not a warm-cache switch.

## Remote guard

Local hosts only by default (`localhost`, `127.0.0.1`, `::1`, `*.localhost`).

- Hosts/labels `prod` or `production`, and `PERF_ENV=prod|production`, are
  **always rejected**.
- Other remotes require **staging** (`PERF_ENV=staging` or a `staging` hostname)
  **and** explicit confirmation (`--confirm-remote` or `PERF_CONFIRM_REMOTE=1`).
- Navigation and redirect targets are inspected **before** the request is sent.
  An unauthorized production/remote redirect aborts as an operational failure.
  The blocked target is not requested and is not written into the report.

There is no production default URL.

## What is collected

Per page, after installing `PerformanceObserver` **before** navigation:

- TTFB, FCP, LCP, CLS
- Navigation duration
- Request count, resource count
- Transfer size when `PerformanceResourceTiming.transferSize` is available
- Failed requests, HTTP status `>= 400`, console / page errors

INP is always `null` with `inpStatus: "unsupported"`. This tool does not
interact with the page, so it must not claim INP.

JSON is deterministic: event rows are sorted before the 50-row cap, object
keys are sorted, query/hash are stripped, UUID/numeric/opaque path IDs are
replaced with `:id`, and console/error text redacts embedded URLs, JWTs,
cookies, tokens, and secrets.

CLS is the maximum Core Web Vitals session window (gap ≤ 1s, window ≤ 5s),
not the sum of every layout shift.

## Exit codes (not an SLO gate)

| Exit | Meaning |
|------|---------|
| 0 | Help, or measurement finished (slow pages, 4xx/5xx, and console errors are data) |
| ≠0 | Bad args, remote guard, missing Playwright/browsers, missing storageState file, navigation/launch failure, write failure |

Lab SLOs are not enforced here. Do not wire this script as a flaky CI gate on
LCP/CLS.

## Limits

- Lab Chromium, viewport 1280×720, `ar-SA` / `Asia/Riyadh` — not field RUM.
- Cross-origin transfer size is often 0 without `Timing-Allow-Origin`.
- Event lists cap at 50 rows (`truncated` flags when capped).
- Does not log in, click, or type; dashboard auth is storageState-only.
- Does not install packages, open a real interactive browser session for
  humans, or change application Playwright projects.
