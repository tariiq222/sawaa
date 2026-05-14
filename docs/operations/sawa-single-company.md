# Sawa operations mode — single-company

This repository is currently operated for مركز سواء as one company/one organization, not as the legacy Deqah multi-tenant SaaS platform.

## Required defaults

- `TENANT_ENFORCEMENT=off`
- `DEFAULT_ORGANIZATION_ID=00000000-0000-0000-0000-000000000001`
- `RLS_GUC_INTERCEPTOR_ENABLED=false` unless a future migration reintroduces a tested single-company RLS path
- `BILLING_CRON_ENABLED=false`

## Legacy SaaS surfaces

The following are legacy Deqah SaaS concepts and must not be used as operational runbooks for Sawa without a fresh design review:

- standalone `apps/admin` super-admin app
- tenant subdomain routing / tenant switching
- tenant isolation CI gates as deployment blockers
- SaaS subscription billing that charges clinics/tenants
- plan-based feature gates and platform usage overage billing

Some environment keys are still present for compatibility with old code paths or validation. Their presence does not mean the feature is part of the Sawa operating model.

## Deployment safety

Do not change live deployment IDs, hostnames, database service names, or object-storage identifiers from documentation-only cleanup. Prefer comments and explicit kill switches over renaming infrastructure until the deployment owner confirms the scope.

Known code risk: some backend production guards still reject `TENANT_ENFORCEMENT=off` / `RLS_GUC_INTERCEPTOR_ENABLED=false` when `NODE_ENV=production`. This package only aligns local examples/docs and does not change boot-time production guard code.

## CI guidance

The old GitHub workflows in `HEAD` included jobs for admin app build/test and tenant-isolation tests under strict/permissive modes. In this working tree those workflow files are already deleted, so there is no active local CI workflow to edit. If workflows are restored later, keep tenant-isolation jobs disabled/non-blocking for Sawa and replace them with single-organization smoke, typecheck, lint, package validation, and docker compose config checks.
