# Local Woodpecker CI implementation plan

Goal: replace GitHub Actions develop PR checks with local Woodpecker, verify PR #100 and merge to develop only after the candidate passes.

Approved scope: owner requested local Woodpecker and cancellation of GitHub CI; prior merge authorization persists. No main merge, production deployment, or inclusion of unrelated uncommitted product edits.

Architecture: native local Woodpecker invokes an isolated Linux test environment inside the existing rootless Docker engine. No production/development environment files enter the runner. Per-run disposable services share a network namespace so existing localhost safety checks remain enforced. Every former develop gate must execute and provide logs with an immutable candidate SHA.

## Ownership and sequencing

1. Worker owns `.woodpecker/ci.yml` and `scripts/ci/`: launcher, runtime and equivalent gate commands. Coordinator owns documentation, old GitHub workflow retirement, CLI setup, final runtime validation and integration. Shared interface: local workflow invokes runner; runner outputs per-phase status plus overall exit code and artifacts. No shared mutable files.
2. Coordinator independently installs official v3.18.0 native CLI and validates checksum. Existing NASQ agent/server are preserved.
3. After implementation, independently review actual diff, syntax, fail-closed behavior, fixture boundaries and coverage parity. Coordinator runs integrated workflow; workers never run broad test/build/lint suites.
4. Diagnose failures from logs without skipping tests. Preserve application fixes outside authorized scope. Re-run affected failing phase only for focused diagnosis; accepted merge requires final candidate evidence.
5. Retire GitHub develop CI triggers and document the replacement, limitations and exact run evidence. Keep main release policy and manual production approval.
6. Commit only scoped CI changes after checks; fast-forward update PR100 source without force only if remote head still matches expected SHA. Confirm full candidate gate success before merge to develop; never merge based on a started or skipped pipeline.

## Review focus

- Dirty checkout contamination: snapshot only Git-tracked candidate and intended CI edits; never local `.env` or node_modules.
- Test DB isolation: localhost test database in nested engine; no host ports or host Docker socket in test runner.
- Failures/skips: report nonzero if any required phase fails or never runs; never suppress test/scan exit codes.
- Artifact freshness: unique run directory, SHA and tree manifest, independent logs, no stale report reuse.
- Parallel activity: preserve native agent and unrelated engine resources; cleanup only per-run owned resources.

## Progress

- Worktree created from e3ddb2752; worker dispatched Astra high with isolated brief.
- Measurement baseline was late; total task attribution remains incomplete.
