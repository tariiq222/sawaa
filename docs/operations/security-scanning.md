# Security scanning

This repository uses a private GitHub repository, so the former CodeQL workflow
is retained at `.github/workflows/codeql.yml` as a clearly named Semgrep CE
workflow. GitHub Code Scanning results are unavailable on the current account;
the Semgrep job and its private Actions artifacts are the review surface.

Semgrep CE is a TypeScript/JavaScript source scan and is not equivalent to CodeQL.
It does not provide full security assurance, dependency vulnerability coverage,
secret detection, runtime verification, penetration testing, or a complete review
of every language or artifact outside the selected TypeScript/JavaScript scope. The existing Gitleaks and Trivy jobs in the
other CI workflows remain in place.

## Coverage and enforcement

The workflow runs a full TypeScript/JavaScript scope scan with Semgrep's `p/ci` rules on:

- pull requests targeting `main` or `develop`;
- pushes to `main` or `develop`;
- the weekly scheduled run; and
- manual `workflow_dispatch` runs.

The scan root is the repository root. It scans the former CodeQL application
language scope through `*.ts`, `*.tsx`, `*.js`, and `*.jsx` includes. It excludes
`node_modules`, `dist`, `coverage`, and `apps/mobile`, matching the existing mobile
boundary. Findings and scanner errors block the job through
`--error --strict`. The scanner step has no `continue-on-error` setting.

The workflow uses Python 3.12 and installs the pinned `semgrep==1.177.0` from
`scripts/security/requirements.txt`. It runs:

```bash
semgrep scan \
  --config p/ci \
  --metrics=off \
  --disable-version-check \
  --error \
  --strict \
  --json --output semgrep-results.json \
  --sarif-output semgrep-results.sarif \
  --include '*.ts' --include '*.tsx' \
  --include '*.js' --include '*.jsx' \
  --exclude '**/node_modules/**' \
  --exclude '**/dist/**' \
  --exclude '**/coverage/**' \
  --exclude 'apps/mobile/**' \
  .
```

JSON and SARIF are written locally and uploaded as one private GitHub Actions
artifact with seven-day retention. The artifact upload fails when either report
is missing. No Semgrep login or token is used: `SEMGREP_APP_TOKEN` is explicitly
empty and `SEMGREP_SEND_METRICS=off` disables metrics. No `security-events` permission,
SARIF upload to GitHub Code Scanning, or Semgrep AppSec Platform connection is
used. The scan may retrieve the public
`p/ci` rule definition, but repository source and findings stay in the runner
and private Actions artifact.

## Reproduction and updates

From the repository root, use Python 3.12 and the pinned requirements:

```bash
python3.12 -m venv .venv-security
. .venv-security/bin/activate
python -m pip install --requirement scripts/security/requirements.txt
semgrep scan --config p/ci --metrics=off --disable-version-check --error --strict \
  --json --output semgrep-results.json \
  --sarif-output semgrep-results.sarif \
  --include '*.ts' --include '*.tsx' \
  --include '*.js' --include '*.jsx' \
  --exclude '**/node_modules/**' \
  --exclude '**/dist/**' --exclude '**/coverage/**' \
  --exclude 'apps/mobile/**' .
```

Dependabot checks the pinned Semgrep package under `/scripts/security` and the
GitHub Actions used by the workflow weekly. Review a Semgrep update for rule
or CLI behavior changes, keep the version pinned, and retain the report and
failure checks when updating the workflow.

## Current settings status

The workflow source confirms triggers, least-privilege `contents: read`, local
report generation, private artifact retention, and blocking scanner behavior.
Repository-level settings are not verified here: confirm that Actions are
enabled, workflow runs from the intended branches are allowed, artifacts are
restricted to repository readers, and the Semgrep job is a required check for
the protected `main` and `develop` branches. Confirm the weekly schedule and a
manual run after publication. These checks are operational settings, not proof
that Semgrep CE provides CodeQL-equivalent coverage.

## Initial validation and broader review backlog (2026-09-11)

The configured `p/ci` TypeScript/JavaScript gate passed locally with Semgrep
1.170.0 and produced valid JSON/SARIF. A synthetic hardcoded JWT signing secret
was detected and returned exit 1, confirming finding failures. GitHub must
validate the pinned 1.177.0 version before merge; local results alone do not
prove that version or deployment readiness.

Exploratory scans outside this gate are not a clean security assessment:
- `p/ci` across all languages reported 60 pre-existing configuration findings,
  including mutable Actions references, dependency policy recommendations and
  shell-expression interpolation. Some workflow expressions also caused
  partial parsing warnings.
- The broader `p/javascript`, `p/typescript` and `p/nodejs` packs reported five
  AES-GCM tag-length findings in credential helpers/scripts and one React HTML
  rendering finding, plus four partial parsing warnings. These need separate
  validation; they are neither confirmed exploits nor dismissed findings.

The gate uses the documented CI-oriented rule pack, not the broader audit
packs. No per-finding baseline, suppression or changed-file-only exclusion was
introduced. Maintain a separate review of the exploratory findings rather than
claiming that a green gate means the whole application is secure.

The obsolete `pull-request-body` entry was removed from Dependabot configuration
because it is not a supported update option; the added pip/Actions update
entries use standard weekly schedules.

## Private repository CI compatibility

The existing CI security job keeps its current dependency-audit, Gitleaks, and
Trivy scope and policy. It grants only `contents: read` and `pull-requests: read`
so Gitleaks can inspect pull-request commits in a private repository. Gitleaks
comments are disabled with `GITLEAKS_ENABLE_COMMENTS=false`, so the job does not
request write access or post unsolicited comments.

Trivy continues to scan the filesystem for HIGH and CRITICAL vulnerabilities with
`ignore-unfixed: true` and `exit-code: '0'`; it is informational in this job.
The job now writes `trivy-fs.sarif` using Trivy's SARIF formatter and stores it in
a private Actions artifact for seven days. Artifact upload runs after the job's
other steps when the report exists. GitHub Code Scanning SARIF upload is not used
because it is unavailable for the current private-repository account.
