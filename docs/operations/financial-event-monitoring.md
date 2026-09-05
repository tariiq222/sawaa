# Financial event monitoring

The backend refreshes bounded financial state before returning its existing
token and IP protected Prometheus endpoint at `/api/v1/public/metrics`.
There is no monitoring UI in this change. Operators use protected application
logs when an investigation needs identifiers; identifiers never appear in
metric labels.

## Live metrics

| Metric | Labels | Persisted definition |
| --- | --- | --- |
| `financial_outbox_events` | `event_type`, `status` | Current `PENDING` or `FAILED` outbox rows. Event type is one of the closed financial list or `unknown`. |
| `financial_outbox_oldest_pending_age_seconds` | `event_type` | Age of the oldest pending row in the same bounded event group. |
| `financial_refund_exceeds_settled_invoices` | none | Invoices whose completed refund sum exceeds gross payments in `COMPLETED`, `PARTIALLY_REFUNDED`, or `REFUNDED`. |
| `financial_overcollected_invoices` | none | Invoices whose gross settled payments minus completed refunds exceed `Invoice.total`. |
| `financial_provider_unknown` | none | Refund requests in the explicit `CALL_UNKNOWN` provider state. |
| `financial_refund_manual_reviews` | none | Refund requests in the explicit `MANUAL_REVIEW` status. |

These are review signals. They do not authorize a refund, collection, replay,
invoice mutation, provider call, or automatic repair. The two invoice balance
gauges use arithmetic facts only and do not choose the unanswered
collection-after-refund policy.

## Collection lifecycle and cost

After the metrics token and source-IP checks pass, the controller asks
`AppMetricsService` to refresh the persisted gauges. Concurrent scrapes share
one in-flight refresh, and a successful snapshot is cached for 30 seconds per
process. A failed first refresh fails the scrape rather than publishing
placeholder zero values.

Each refresh executes three read-only aggregate queries:

1. Outbox count and oldest pending time grouped in SQL. The SQL maps unknown
   event types before grouping, so the result has at most 18 rows: eight
   closed types plus one `unknown`, across two statuses.
2. Settled-payment and completed-refund sums grouped by invoice, followed by
   two aggregate mismatch counts. Payment and refund sums are separate CTEs,
   preventing multiplicative joins.
3. Two fixed refund-state counts for `CALL_UNKNOWN` and `MANUAL_REVIEW`.

No query selects payloads, IDs, names, emails, phone numbers, provider data, or
full entity rows. `OutboxEvent` does not persist a consumer ID, so the live
outbox metrics omit that dimension rather than attributing rows to an invented
consumer. Unknown event types are summed under the bounded `unknown` event
label while retaining a valid pending/failed status and its oldest age.
Invalid statuses use the separate bounded `unknown` status. A duplicate tuple
is summed and retains the maximum oldest age.

The existing `outbox_terminal_failures_total` remains the transition counter
incremented by the publisher. O4 did not expose pool saturation or deadlock
metrics because no existing runtime hook supplies those observations.

## Alerting

Choose thresholds from measured local and production behavior:

- alert when oldest pending age exceeds the normal publisher retry window;
- page for persistent failed financial outbox rows;
- review any non-zero refund-exceeds-settled, overcollected, provider-unknown,
  or manual-review count.

The refresh cadence and queries are bounded, but local timing is not a
production capacity claim. Measure query duration on the deployment database
before choosing scrape intervals or alert windows.

## Operational boundaries

- The endpoint still requires `INTERNAL_METRICS_TOKEN`; the configured
  `INTERNAL_METRICS_ALLOWED_IPS` allowlist is unchanged.
- Metrics are process-local. They do not prove cross-instance aggregation,
  proxy latency, queue latency, report capacity, or production readiness.
- Correlation IDs remain in protected logs only.
