# Jev remediation follow-up

User scope: verify and repair the four open gates from the earlier local batch: mobile customer identity, Moyasar sandbox, Trivy/Node Docker runtime, and mobile device execution.

Integration checkout: `codex/jev-integration`, base `a4f5d759`. Changes are local and uncommitted. Remote Actions evidence from other revisions is diagnostic only.

## Packages and contracts

1. Client identity (Luna/high, isolated `jev-client-identity`): issue Client namespace tokens after customer OTP; preserve staff User namespace and existing guard authority. Link explicitly or by verified phone only, fail closed on conflicts, serialize refresh/logout, preserve mobile session epoch fences. Add real-database HTTP regression coverage and a read-only legacy linkage audit. No destructive migration or email-based merge.
2. Runtime/security (Luna/high, isolated `jev-runtime`): Node 22 Docker stages, actual Trivy scan covering the standalone mobile lockfile, compatible dependency repairs, and observed nightly fixture/health-check failures. No vulnerability suppression.
3. Device validation (Luna/high, isolated temporary native build): actual simulator startup and device availability, screenshots/runtime evidence, then customer journey after identity integration. Simulator evidence does not satisfy the physical-device gate.
4. Coordinator: safe sandbox credential probe, diff review, integration, OpenAPI generation, required regression gate wiring, final tests/image builds, and evidence report.

Identity and runtime code ownership is separate; the device customer journey depends on integrated identity. Final shared dependencies, generated contracts and validation belong to the coordinator.

## External verification gates

- Local stored Moyasar test configuration was queried read-only; actual `GET /v1/payments?per=1` returned HTTP 401 on 2026-09-18. No payment was created. A valid approved test key is required for provider lifecycle verification; live credentials must not be substituted.
- Known physical iPhone was unavailable at inspection. Device must be connected/unlocked with Developer Mode before physical testing can be claimed.
- Running GitHub Actions against this patch requires the patch to be published. A fix request alone does not authorize commits or pushes under `docs/operations/deployment-policy.md` in the primary checkout.

## Acceptance evidence

Record exact pass/fail/skip counts and test paths; real-DB suites must not silently skip. Validate website Client auth compatibility, customer/staff namespace isolation, OTP concurrency and failed attempts, refresh/logout replay, client profile routing and stale-session protection. Build actual Node 22 images and execute Trivy against both dependency locks. Preserve provider/device/remote-CI gaps explicitly if their prerequisites remain unavailable.
