# Security Policy

## Reporting a Vulnerability

Email **security@sawaa.sa** with:

- Description of the issue (attack scenario, affected endpoint, impact)
- Steps to reproduce
- Your name / handle (credit-by-default unless you request anonymous)
- We aim to acknowledge within **2 business days** and triage within
  **5 business days**.

Please **do not** open a public GitHub issue for security problems.

## Scope

- All code under `apps/` and `packages/`
- The NestJS backend at `apps/backend/` (any endpoint under `/api/v1/`)
- The Next.js dashboard at `apps/dashboard/`
- The mobile API consumed by the mobile app

## Out of Scope

- Third-party npm packages (report upstream to npm/GitHub)
- DDoS / volumetric attacks
- Social engineering against staff
- Physical security of the data center

## Disclosure Timeline

- Day 0: report received
- Day 2: acknowledgement
- Day 5: triage
- Day 30: target fix
- After fix: coordinated disclosure

We follow responsible-disclosure norms. Researchers who act in
good faith and avoid privacy violations / service disruption are
welcome to test our public endpoints.
