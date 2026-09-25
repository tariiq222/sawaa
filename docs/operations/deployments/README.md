# Deployment records

A code release and a successfully observed deployment are different events. `release.yml` owns only the former. This directory may contain reviewed, sanitized deployment receipts; it does not contain a verified receipt for existing environments yet.

## Collection and recording

1. Obtain the expected full Git commit from the frozen release candidate, and independently resolve the active OpenShip deployment's source commit. Do not substitute current `main`, a tag, an image name, or a requested commit for an observed running commit.
2. Verify the intended OpenShip project/environment and active deployment status. Check all six service identities, their deployment IDs and Docker health; collect backend readiness and dashboard/website HTTP 200 results from that same environment. Do not mix observations across concurrent deployments.
3. Save only the fields in `evidence.example.json` to a private local evidence file. Replace every placeholder, use canonical UTC time including milliseconds, and identify the operator. Keep raw provider payloads, URLs with tokens, container environment dumps and credentials out of Git.
4. Run from the repository root:

   ```sh
   node scripts/record-deployment.mjs /secure/path/evidence.json docs/operations/deployments/2026-09-24-production-DEPLOYMENT.json
   ```

   Choose a new filename containing the observation date, environment and deployment identity. The script refuses existing output paths, failed/incomplete checks, mismatched commits or deployment IDs, observations in the future or older than 24 hours, and inputs larger than 64 KiB. It copies only permitted fields, includes a SHA-256 of the input evidence, and creates the file with mode 0600. Review the result before adding it to a PR. It never commits, pushes or contacts OpenShip.
5. Preserve the input evidence privately to allow hash verification. Link the receipt from `../current-state.md` with its observation time and verification limits. Update through the normal PR path, not a direct commit to main. Recording a receipt is not authorization to deploy.

## Meaning and limits

`status: verified` means the **operator-supplied attestation** meets this contract. `verificationSource: operator-attestation` makes that trust boundary explicit. The CLI cannot detect fabricated input, confirm remote access, enforce manual owner acceptance, or replace OpenShip/GitHub protections. The evidence hash binds bytes, not truth. Neither the record nor its timestamp proves that the deployment remains active later.

HTTP readiness is not full booking/payment/device acceptance. Keep acceptance evidence, backup/restore checks, migration compatibility and rollback identity alongside the release review. Never restore an old database as part of a code rollback without separate authorization.

The example is deliberately incomplete and cannot create a verified record. Do not replace placeholders by guessing. If the running SHA cannot be resolved, report it as unverified and leave the receipt absent.
