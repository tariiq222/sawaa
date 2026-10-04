# Client payment permission and cancellation consent — acceptance

Candidate branch `codex/client-booking-consent`. Source base `e4db299c6`; fast-forwarded to `c0c928764` (identical tree) to carry production-release ancestry back through the task PR into develop.

ONLINE pay-at-clinic requires both organization capability and the effective client booking permission. Staff reception behavior is preserved. Public/mobile cancellation requires explicit refund-term acceptance and a current preview fingerprint. Legacy and enabled-policy paths reject missing or stale consent without cancellation/refund writes. Web/mobile refresh stale terms and require another explicit confirmation. Chat directs clients to appointment details rather than cancelling without displayed consent.

Legacy PUBLIC/MOBILE approval and single-capture refund semantics are retained. Approval previews promise no final refund amount. An internal legacy event marker preserves mobile Zoom cleanup using the durable subscriber. Review found and corrected a clock-boundary mismatch: legacy execution now uses the validated refund percentage instead of reading the clock again. Deterministic tests reproduced the old100%→25% mismatch before correction. Group/status eligibility follows the existing client UI and shared handler contract.

No schema migration, provider-handler redesign, customer-data replacement, credential change or encryption-key change is included. Verification uses new local synthetic databases; staging and production data are not promoted between environments.

## Evidence

Private local evidence: `.superpowers/sdd/client-consent/` in the isolated worktree.

- Critical real PostgreSQL/HTTP:36 suites308 cases passed.
- Dashboard production build and smoke:42 passed.
- Live public/mobile API:15 missing/invalid/stale/valid/replay checks passed; rejected requests left booking/log/outbox/refund state unchanged.
- Actual Moyasar Sandbox: synthetic SAR100 payment, consented SAR50 refund, one completed refund request/provider attempt, idempotent replay without additional settlement. This is refund integration evidence, not checkout/3DS or production-provider acceptance.
- Website browser: displayed SAR50, changed synthetic settings to SAR40, old confirmation rejected while appointment remained confirmed, refreshed terms required another click; second confirmation cancelled with SAR40 pending staff review. Screenshots retained locally.
- Mobile:171 suites1143 cases with coverage passed; types passed. No new native binary, simulator or physical-device acceptance in this task.
- OpenAPI regenerated;300 routes checked with zero new documentation gaps;66 API-client endpoints matched; dashboard/mobile/API-client types and scoped source lint passed.
- Broad backend:870 suites8348 cases passed, one existing DB-dependent case skipped. Earlier attempts exposed missing synthetic test env and two obsolete DTO fixtures; neither failed run is counted as accepted. The final complete run passed; a subsequent test-only nullable fixture correction passed42 handler cases and full backend types.
- Website:103 files910 cases passed. Earlier run exposed two obsolete API fixtures without consent; the full corrected run passed.
- Additional mobile HTTP/realSQL:19 cases passed. An old assertion tied to unchanged403 English wording was replaced with status403 plus absence of booking fields.
- Final backend build, all affected app/package typechecks and scoped lint passed. Legacy liveHTTP on the corrected binary rejected missing/stale consent, then created one refund request for the accepted2500 halalas and replayed safely.
- Independent spec/quality review identified one P2 clock-boundary mismatch. Corrected code and regression were re-reviewed with no remaining blocking findings.

## Release boundaries

Older mobile binaries do not send the required consent field and will be rejected when cancelling. A compatible mobile update and explicit acceptance of this behavior are required for production rollout; this task does not upload TestFlight or submit an app.

Owner authorized staging and main publication. Main promotion still requires the owner's manual acceptance of the exact new staging revision, a fresh backup-readiness check and successful release gates. Earlier release acceptance does not cover this code.

Routing policy `astra-effort-v1`: native Astra high implementation and independent review. Meter baseline began late and receipt attachment encountered a preexisting parser error; complete task token/quota attribution is unknown.
