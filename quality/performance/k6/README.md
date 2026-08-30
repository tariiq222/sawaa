# k6 performance harness (read-only)

Safe, repeatable GET-only load scripts for local (default) or explicitly confirmed staging. This folder does **not** ship k6, does **not** define production SLOs, and does **not** claim latency or capacity numbers.

Default base URL: `http://127.0.0.1:3450` (docker-compose host mapping `3450:5200` onto the Nest backend). There is no production URL default.

## Safety abort gates

Scripts are k6 ES modules (`import` / `export`). Keep the `.js` extension.

`setup()` in every script calls `assertSafeTarget()` in `safety.js` and **throws** (k6 aborts) when:

1. Any hostname **label** is `prod`, `production`, `*-prod`, or `*-production` (always refused, independent of `PERF_ENVIRONMENT`).
2. `PERF_ENVIRONMENT` is `prod` or `production` (always refused).
3. The target URL includes username/password, a query string, or a fragment (always refused). Guard errors are generic or a redacted origin only — they never print the raw URL.
4. The target host is not loopback (`127.0.0.0/8`, `localhost`, `::1`) unless **all** of these are set:
   - `PERF_ENVIRONMENT=staging`
   - `PERF_ALLOW_REMOTE=true`
   - `PERF_CONFIRM_NON_PRODUCTION=YES` (exact value)

Optional run-fail / abort-on-breach gates (off by default):

- `PERF_P95_MS` (default `2000`) — **`http_req_duration_2xx` p95 only** (accepted business responses)
- `PERF_ERROR_RATE` (default `0.05`) — **`http_collapse` rate** (3xx / other 4xx / 5xx / transport). Independent of 429.
- `PERF_ABORT_ON_FAIL=true` — k6 `abortOnFail` on those two thresholds

Mixed `http_req_duration` is **not** an acceptance metric: 429s are often fast and can pull p95 down. 429 latency is a separate trend (`http_req_duration_429`) and is reported, not gated.

`http_429` is a counter for limiter engagement. A 429 is **counted protection**, not `http_req_failed`, not collapse, not business 2xx success, and not a silent crash.

## Redirects and status classes

Every GET sets `redirects: 0`. A **3xx is unexpected**: it fails the check and counts as collapse. The harness does **not** follow the hop (following would bypass the URL guard in `assertSafeTarget()`).

Checks classify each response:

| Class | Meaning |
| --- | --- |
| 2xx | Business success; feeds `http_req_duration_2xx` (the p95 gate) |
| 429 | Counted protection; feeds `http_req_duration_429` + `http_429` |
| 3xx | Unexpected; not followed; collapse / check failure |
| 5xx | Collapse / check failure |

## Edge via nginx vs backend direct

| Target | Typical URL | What you measure |
| --- | --- | --- |
| Backend direct | `http://127.0.0.1:3450` (default) | Nest only. Compose publishes `3450:5200`. No nginx gzip, TLS, or `limit_req`. |
| Edge / nginx | whatever fronts `/api/` (compose prod stack, TLS on 443) | Full path: nginx → backend. Gzip, proxy timeouts, and **rate limits** apply. |

Nginx (`docker/nginx/nginx.conf`):

- General API: `limit_req_zone` `api_limit` at **30 r/s** per client IP, burst 50, `limit_req_status 429`.
- Auth (`/api/v1/auth`, `/api/v1/otp`): **5 r/s**, burst 10. **This harness never hits auth.**
- `/api/v1/health/live` and `/api/v1/health/ready` are proxied **without** the general `limit_req` and with access log off.
- Other public GETs (`/api/v1/public/...`) go through `location /api/` and **are** rate-limited at the edge.

Do not compare a direct-backend run with an nginx run. Do not raise VUs until you have decided which path you are measuring.

## What these scripts hit

GET only. No `Authorization`. No request bodies. No path IDs.

| Script | Routes (stable `route` / `name` tags) |
| --- | --- |
| `health.js` | `health_live` → `/api/v1/health/live`; `health_ready` → `/api/v1/health/ready` (separate scenarios) |
| `public-read.js` | OpenAPI public GETs: `/api/v1/public/branding`, `/services`, `/employees`, `/testimonials`, `/programs` |
| `mixed-read.js` | Health live + ready + the five public GETs, `ramping-vus` stages |

Never included: auth, OTP, payments, SMS, email, Zoom, AI/chatbot, bookings writes, enroll, webhooks, dashboard, or any `{id}` path.

## Suggested commands (profiles, not results)

Install k6 yourself. Do not pull images or generate load from CI unless an operator opts in.

Warm-up (defaults are already small):

```bash
k6 run quality/performance/k6/health.js
k6 run quality/performance/k6/public-read.js
k6 run quality/performance/k6/mixed-read.js
```

Step (slightly higher VUs, still local):

```bash
PERF_WARMUP_DURATION=15s PERF_WARMUP_VUS=1 \
PERF_STEP_DURATION=30s PERF_STEP_VUS=4 \
PERF_SPIKE_DURATION=1s PERF_SPIKE_VUS=4 \
PERF_SOAK_DURATION=20s PERF_SOAK_VUS=4 \
PERF_COOLDOWN_DURATION=10s PERF_COOLDOWN_VUS=0 \
k6 run quality/performance/k6/mixed-read.js
```

Spike (short peak; watch 429s at nginx):

```bash
PERF_WARMUP_DURATION=10s PERF_WARMUP_VUS=1 \
PERF_STEP_DURATION=10s PERF_STEP_VUS=2 \
PERF_SPIKE_DURATION=15s PERF_SPIKE_VUS=10 \
PERF_SOAK_DURATION=10s PERF_SOAK_VUS=2 \
PERF_COOLDOWN_DURATION=10s PERF_COOLDOWN_VUS=0 \
k6 run quality/performance/k6/mixed-read.js
```

Soak (longer plateau; keep VUs modest, especially behind nginx 30 r/s):

```bash
PERF_WARMUP_DURATION=30s PERF_WARMUP_VUS=1 \
PERF_STEP_DURATION=15s PERF_STEP_VUS=2 \
PERF_SPIKE_DURATION=1s PERF_SPIKE_VUS=2 \
PERF_SOAK_DURATION=10m PERF_SOAK_VUS=2 \
PERF_COOLDOWN_DURATION=20s PERF_COOLDOWN_VUS=0 \
k6 run quality/performance/k6/mixed-read.js
```

Staging (remote) — required trio, never prod:

```bash
PERF_BASE_URL=https://staging.example.invalid \
PERF_ENVIRONMENT=staging \
PERF_ALLOW_REMOTE=true \
PERF_CONFIRM_NON_PRODUCTION=YES \
k6 run quality/performance/k6/health.js
```

Abort if 2xx p95 or collapse rate breaches:

```bash
PERF_ABORT_ON_FAIL=true PERF_P95_MS=2000 PERF_ERROR_RATE=0.05 \
k6 run quality/performance/k6/mixed-read.js
```

## Env reference

| Variable | Default | Role |
| --- | --- | --- |
| `PERF_BASE_URL` | `http://127.0.0.1:3450` | Target origin, no trailing slash required |
| `PERF_ENVIRONMENT` | `local` | `prod` / `production` always abort. Production hostname labels abort even when this is `local` or `staging`. |
| `PERF_ALLOW_REMOTE` | `false` | Must be `true` for non-loopback |
| `PERF_CONFIRM_NON_PRODUCTION` | empty | Must be `YES` for non-loopback |
| `PERF_VUS` / `PERF_DURATION` | `1` / `10s` or `15s` | health + public-read |
| `PERF_SLEEP` | `0.2` | Think time between GETs (seconds) |
| `PERF_WARMUP_*` `PERF_STEP_*` `PERF_SPIKE_*` `PERF_SOAK_*` `PERF_COOLDOWN_*` | small | mixed-read stages (`DURATION` + `VUS`) |
| `PERF_P95_MS` / `PERF_ERROR_RATE` / `PERF_ABORT_ON_FAIL` | `2000` / `0.05` / `false` | Gates on `http_req_duration_2xx` p95 and `http_collapse` rate |

Syntax check (ESM parse only, no load, no network). Use stdin + `--input-type=module`; do **not** use `node --check file.js` (that parses `.js` as CommonJS):

```bash
node --input-type=module --check < quality/performance/k6/safety.js
node --input-type=module --check < quality/performance/k6/health.js
node --input-type=module --check < quality/performance/k6/public-read.js
node --input-type=module --check < quality/performance/k6/mixed-read.js
```

Guard self-test (data-URL import of `safety.js`, no extra file, no network). Covers production host labels, credentials/query/fragment redaction, and local/staging policy:

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
const src = readFileSync("quality/performance/k6/safety.js", "utf8");
const mod = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
if (mod.runGuardSelfTests() !== "ok") {
  throw new Error("safety guard self-test failed");
}
'
```
