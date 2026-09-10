# Intake response history rollout

This is an implementation runbook. No production migration, data reconciliation, deletion, or release has been performed by this local work.

## Expansion and compatibility

1. Record the deployed application/worker versions, database identity, backup and restore evidence, and current-response duplicate counts in a protected location. Do not copy answer contents into logs or Git.
2. Apply additive migration `20260905000100_intake_response_history`. It adds nullable response metadata and an empty revision table, preserving existing rows. It uses a five-second lock timeout and a sixty-second statement timeout. A migration failure stops rollout; investigate its recorded state before any repair. Never edit an applied migration.
3. Deploy the compatible intake submission, reading and deletion paths. The submission transaction serializes each booking/form pair, checks ownership and form validity, preserves the current response ID, and snapshots the prior answer before a change. Identical answers do not create a revision. More than one current row produces a conflict for that pair until reviewed reconciliation.
4. Verify ordinary and concurrent synthetic submissions, protected history retention, and unchanged caller permissions in the target environment. Only the approved deletion operation removes live responses; history is retained without cascading foreign keys. Existing financial deletion restrictions remain in force.

The expansion accepts old INSERT statements and preserves legacy answer rows. This is schema compatibility, not proof that all deployed writers follow the new serialization contract. Before canonicalization or any partial unique index, inventory and drain old backend instances, workers, operator processes and saved import commands. That production inventory is still pending.

## Legacy importer

The current `applyLegacyImportPlan` refuses to write after the `supersededAt` column is installed. This barrier protects both the CLI caller and direct callers; there is no force flag. Before expansion, its existing offline import and explicit CLI target/hash confirmation rules remain applicable.

The read-only import planner and audit remain available. The audit retains all current and superseded live responses in its original totals and adds separate counts for current responses, superseded responses and revision snapshots. It never interprets the latest answer as clinically canonical.

An older binary will not contain the new barrier. Disable its scheduled or manual invocation operationally and verify that it has stopped before enabling reconciliation. A future compatible importer needs the same locking/history contract and separate review; simply bypassing the check is not a supported operation.

## Reconciliation and rollback

No canonical choice or partial unique index is part of the expansion. T4 must produce a protected manifest with source IDs and answer hashes, obtain a decision for differing answers, revalidate under the same pair lock, and preserve every original answer row. Historical apply needs its own authorization.

Before canonicalization, an older reader can read the additive schema, but can still recreate the original duplicate/lost-update problem. Prefer a compatible forward fix. After canonicalization, rollback must retain a reader that filters `supersededAt IS NULL`; never erase all supersession markers or drop revision history to accommodate an old binary.

## Local rehearsal evidence

On the isolated `sawaa_safe_test_ecfc` database, the two intentionally conflicting pre-expansion responses retained their count and answer checksum after migration; both new metadata fields stayed null. An old-shape INSERT also succeeded. All 96 migrations and vector hooks succeeded on the separate empty `sawaa_history_fresh_test_ecfc` database, with an empty revision table. Protected execution artifacts are listed in `safe-improvement-release-log.md`; these results do not establish production readiness.
