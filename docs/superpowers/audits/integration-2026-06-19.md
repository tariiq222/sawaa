# Integration Audit — 2026-06-19

skill_version: 1.1.0
scope: dashboard
commit: 729ae1f699c289bd1c27d24af6806f0642cb5852
previous_audit: none (no prior audit file; no memory Metrics block → Δ is baseline)

## Metrics
P0: 0 · P1: 2 · P2: 6 · P3: 3 · Ignored: 0 · Unanalyzable: 0
Δ from baseline: P0 +0 · P1 +2 · P2 +6 · P3 +3

Surface counts:
- Dashboard endpoints in OpenAPI snapshot: **197** (132 distinct path-shapes)
- Dashboard endpoints consumed by FE app code: **~117 path-shapes**
- Direction of drift: FE is a strict subset of BE. **Every FE call has a backend** (0 FE→missing-BE, so 0 P0). All findings are the reverse: backend operations with **no dashboard UI**.

## Top 20 Findings
| # | Severity | Layer | Title | Location | Δ since last |
|---|---|---|---|---|---|
| 1 | P1 | 7 | Refund approval queue has no UI — client refund requests can't be actioned | BE `refunds.controller.ts`; FE: none | new |
| 2 | P1 | 7 | Problem reports (list/create/status) — no dashboard screen | BE `platform.controller.ts`; FE: none | new |
| 3 | P2 | 7 | Platform integrations (list/create) — no UI | BE `platform.controller.ts`; FE: none | new |
| 4 | P2 | 1 | Soft-deleted service restore — DELETE wired, restore not | BE `organization.controller.ts` `services/{id}/restore`; FE: none | new |
| 5 | P2 | 7 | Employee schedule **exceptions** (GET/POST/DELETE) not surfaced | BE `people.controller.ts`; FE has vacations+breaks only | new |
| 6 | P2 | 7 | Bundle booking creation (`POST bookings/bundle`) not wired | BE `bookings.controller.ts`; FE: none | new |
| 7 | P2 | 7 | Coupon **apply** action (`POST finance/coupons/apply`) not in dashboard | BE `finance.controller.ts`; FE coupons CRUD only | new |
| 8 | P2 | 7 | AI chatbot **test/chat** (`POST ai/chat`) — no playground to test the bot | BE `ai.controller.ts`; FE manages config+KB only | new |
| 9 | P3 | 1 | `GET dashboard/stats` orphan — superseded by `/ops/reports` | BE `stats.controller.ts`; FE uses reports + top-performers | new |
| 10 | P3 | 1 | `GET bookings/stats` orphan — superseded by reports | BE `bookings.controller.ts`; FE: none | new |
| 11 | P3 | 1 | `GET finance/payments/stats` orphan — not consumed | BE `finance.controller.ts`; FE: none | new |
| 12 | P3 | 1 | `POST finance/payments/bank-transfer` superseded by `POST finance/payments {method:BANK_TRANSFER}` | BE `finance.controller.ts`; FE `payments.ts:recordPayment` | new |
| 13 | P3 | 1 | `GET bookings/availability` unused — wizard uses `employees/{id}/slots` | BE `bookings.controller.ts`; FE `use-booking-slots.ts` | new |
| 14 | P3 | 1 | `GET finance/invoices/{id}` (detail) not consumed — FE lists + pdf only | BE `finance.controller.ts`; FE `invoices.ts` | new |
| 15 | P3 | 1 | `GET media/{id}` (detail) not consumed — FE uses presigned-url only | BE `media.controller.ts`; FE | new |
| 16 | P3 | 1 | `POST people/employees/{id}/onboarding` (per-id) duplicate of collection `employees/onboarding` | BE `people.controller.ts`; FE uses collection form | new |

(16 distinct findings covering ~20 unconsumed endpoints; no items beyond 20.)

## Layer 1 — Endpoints (path/method existence)
- FE call sites extracted from `apps/dashboard/lib/api/*.ts`, `hooks/`, `components/`, `app/` (all quote styles).
- **0 FE calls resolve to a missing backend route.** TypeScript-generated client (`lib/types/api.generated.ts`) keeps the FE honest against the OpenAPI snapshot.
- **Unconsumed backend routes** = findings 4, 9–16 above. These are the operation-coverage gap the request targets.

## Layer 2 — DTO request fields
- Not exhaustively field-audited. Request bodies flow through the generated client types, so structural request drift is compile-time caught. The one boundary adapter is `bookings.ts` (`date`+`startTime` → `scheduledAt`, enum upper-casing) — correct and intentional. No P1/P2 request-field drift surfaced.

## Layer 3 — DTO response shape
- Responses consumed through generated types; renamed/removed fields would fail typecheck. No P0 response drift surfaced. Not exhaustively field-audited.

## Layer 4 — Error contracts
- Not deep-audited this run. Auth/refund error envelope handled centrally in `@sawaa/api-client`. No drift flagged.

## Layer 5 — Auth & permissions
- Dashboard routes sit behind the global JWT guard + CASL (`canDo` in `auth-provider`). No FE route was found exposing a BE-protected operation without a guard. The unconsumed endpoints (findings above) are *missing UI*, not *missing guards*. No P0.

## Layer 6 — DB models & tenant scoping
- Out of scope for a dashboard-only run (single-tenant; no `organizationId` filters by design). Not audited.

## Layer 7 — Features (UI ↔ slice parity)
Backend capabilities with **no dashboard surface**:
- **Refunds approval** (request→approve/deny) — only manager-initiated `PATCH payments/{id}/refund` exists in UI (`refund-dialog.tsx`). The client-requested refund queue is unbacked. → #1
- **Problem reports**, **platform integrations** — controllers exist, no screens. → #2, #3
- **Bundle bookings**, **coupon apply**, **AI chat test**, **service restore**, **schedule exceptions** — partial feature surfaces. → #5–8, #4

## Appendix — full findings (>20)
None beyond the 16 listed.

## Unanalyzable call sites
None. `/api/proxy/auth/*` calls are the Next proxy rewrite to `/auth/*` and resolve cleanly.

## Ignored items (from .integration-audit-ignore)
None — no ignore file present (Ignored: 0).

## Audit feedback
- [ ] False positives (paste finding IDs):
- [ ] Missing findings (describe):
- [ ] Add to ignore list (paste suggested patterns):

### Notes for next run
- Findings 9–16 are **orphan/superseded** candidates — confirm with owner whether to **build UI** or **delete the endpoint**. If "delete", they leave the gap entirely (not a FE task).
- Finding #5 (exceptions) needs owner semantics: is "exception" distinct from "vacation", or legacy? Branch `feature/clinic-as-booking-unit` is actively wiring employee pricing/durations — exceptions may be in-flight.
- Layers 2–4, 6 were not exhaustively field-audited this run; a `--scope full` run with field-level DTO diffing is the natural follow-up.
