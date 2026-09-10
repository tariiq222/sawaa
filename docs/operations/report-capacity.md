# Report capacity evidence

This document records a local engineering benchmark for the revenue and bookings report builders. It is not a production capacity promise. Production data shape, hardware, request deadline, replica count, and operational traffic are not available.

## Exercised layer

`apps/backend/scripts/performance/report-benchmark.ts` calls the accepted report builders directly through the real Prisma/PostgreSQL adapter. Each report wave runs an ordinary indexed `Booking.count` query at the same concurrency. The benchmark does not exercise HTTP, authentication, reverse proxies, BullMQ, or external providers, so it does not report proxy latency or queue lag.

The dedicated database is `sawaa_perf_test_ecfc` in the task-owned PostgreSQL container. It has all 96 migrations and vector hooks. The deterministic fixture grows from 5,000 to 50,000 bookings, invoices, and payments, with five branches, 100 employees, six payment methods, six payment states, ten booking states, three booking types, coupons, and zero/partial/full refund patterns. Dates cover January and February 2026. Every concurrency has five waves, yielding 5, 25, or 50 latency samples for concurrency 1, 5, or 10.

The measured host was Apple arm64 with 14 logical CPUs and 24 GiB RAM. The PostgreSQL container had no explicit CPU or memory limit; PostgreSQL reported `max_connections=100`, `shared_buffers=128MB`, and `effective_cache_size=4GB`.

## Accepted F3 baseline

Values are milliseconds except RSS. Peak RSS is process-wide and can carry memory retained by earlier scenarios; it is useful as an upper-bound observation within this one run, not isolated per-request allocation.

| Rows | Work | Concurrency | p50 | p95 | Peak RSS | Ordinary booking count p95 |
|---:|---|---:|---:|---:|---:|---:|
| 5,000 | Revenue | 1 | 34.3 | 60.5 | 214 MiB | 64.5 |
| 5,000 | Revenue | 10 | 236.9 | 242.7 | 416 MiB | 235.6 |
| 5,000 | Bookings | 1 | 9.9 | 15.0 | 221 MiB | 2.4 |
| 5,000 | Bookings | 10 | 57.3 | 86.4 | 418 MiB | 91.2 |
| 50,000 | Revenue | 1 | 216.8 | 241.0 | 409 MiB | 31.3 |
| 50,000 | Revenue | 10 | 2,253.0 | 2,481.0 | 858 MiB | 2,189.1 |
| 50,000 | Bookings | 1 | 80.4 | 82.2 | 417 MiB | 3.4 |
| 50,000 | Bookings | 10 | 554.5 | 809.3 | 671 MiB | 86.4 |

The baseline query plans read 50,000 payment rows, 12,500 refund rows (8,333 returned after status filtering), and 50,000 booking rows for the full reporting interval. PostgreSQL execution of those individual scans was 16.9 ms, 2.9 ms, and 6.2 ms respectively; most observed builder cost is row materialization, transfer, JavaScript aggregation, and concurrent memory pressure. A new index is not justified by this full-range evidence: PostgreSQL correctly chose sequential scans, and an index would still need to visit nearly every selected row.

## Post-aggregation measurement

The final after run started with no other task database sessions visible in
`pg_stat_activity`. Baseline and after are separate local process runs, so the
comparison shows the change in shape and observed local behavior rather than a
production speedup guarantee.

| Rows | Work | Concurrency | Baseline p95 | After p95 | After peak RSS | Concurrent booking count after p95 |
|---:|---|---:|---:|---:|---:|---:|
| 5,000 | Revenue | 1 | 60.5 | 23.5 | 97 MiB | 18.2 |
| 5,000 | Revenue | 5 | 150.1 | 74.6 | 124 MiB | 20.1 |
| 5,000 | Revenue | 10 | 242.7 | 42.8 | 128 MiB | 36.5 |
| 5,000 | Bookings | 1 | 15.0 | 7.3 | 100 MiB | 4.0 |
| 5,000 | Bookings | 5 | 44.7 | 40.0 | 125 MiB | 37.3 |
| 5,000 | Bookings | 10 | 86.4 | 17.3 | 129 MiB | 15.7 |
| 50,000 | Revenue | 1 | 241.0 | 67.7 | 111 MiB | 12.4 |
| 50,000 | Revenue | 5 | 1,123.2 | 101.5 | 113 MiB | 55.4 |
| 50,000 | Revenue | 10 | 2,481.0 | 152.9 | 122 MiB | 112.6 |
| 50,000 | Bookings | 1 | 82.2 | 66.2 | 112 MiB | 6.9 |
| 50,000 | Bookings | 5 | 442.7 | 54.5 | 115 MiB | 30.7 |
| 50,000 | Bookings | 10 | 809.3 | 90.1 | 127 MiB | 68.1 |

At 50,000 rows, database aggregation returned 6 payment-status rows, 3
settled-method rows, 35 Riyadh day rows, 1 refund total, 2 coupon rows, 1
booking summary, 35 booking-day rows, 168 heatmap rows, and 3 cancellation
reason rows. PostgreSQL still reads the scoped source rows to compute those
values; the improvement is that it does not materialize and transfer the full
sets to Node.

The live financial-metrics refresh was sampled ten times on the same 50,000
payment / 12,500 refund fixture. Its three aggregate queries measured 45.5 ms
p50 and 257.8 ms p95 (the p95 is the single cold maximum in ten samples). A
successful result is cached for 30 seconds per API process. This local result
supports measuring the scrape interval in the deployment environment; it does
not establish a production alert cadence.

## Operating budget

Each API process configures a Prisma pool maximum of 25 connections. Keep report concurrency bounded inside that same process because ordinary requests, outbox work, cron tasks, and administration share the database connection budget. Until production traffic and deadlines are measured, do not schedule ten large reports concurrently; the baseline shows that this can materially delay ordinary booking work. Apply an external concurrency cap only after the post-aggregation measurement and an operating owner chooses a request deadline.

Revenue and bookings Excel exports contain aggregate summary/group rows. They do not export the raw 5,000 or 50,000 underlying records. Once database-side aggregation bounds those result sets, streaming and a background export job would add operational state without evidence of need. Existing exported values on these two paths are numeric values, fixed metric labels, dates, and enums; client, service, and coupon text is not written into their workbooks, so O4 does not change the formula-injection surface.

## Reproduction

The archived baseline JSON was produced before the SQL source changed.
Reproducing it requires restoring the checksummed F3 source copies in
`o4-reference/` into an isolated checkout. Running the current optimized
checkout with `--phase=baseline` would mislabel optimized behavior.

To reproduce the current after measurement, create and migrate the dedicated
database first, then run from the repository root with a protected environment
file:

```bash
set -a
source /absolute/path/to/performance.env
set +a
pnpm --filter=backend exec tsx scripts/performance/report-benchmark.ts \
  --phase=after \
  --output=/absolute/path/to/o4-report-benchmark-after.json
```

The script refuses any database whose name is not exactly `sawaa_perf_test_ecfc`, clears only `o4-*` synthetic fixtures, and writes raw JSON to the requested path. Do not point it at an existing development, shared-test, staging, or production database.

## Evidence

Raw evidence lives outside the repository in the task artifact directory:

- `o4-report-benchmark-baseline.json`: every latency sample, canonical report outputs, and `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans.
- `o4-report-benchmark-baseline.log`: process output.
- `o4-benchmark-environment.txt`: measured host/container/database settings.
- `o4-monitoring-query-timing.json`: ten direct aggregate refresh samples.
- `o4-reference/`: checksummed accepted F3 source snapshots captured before SQL changes.
