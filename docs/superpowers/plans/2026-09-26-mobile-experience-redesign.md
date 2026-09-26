# Mobile experience redesign implementation plan

## Prerequisite
Worktree branch contains clinic/service contract commit 17b07e431. The source design is docs/superpowers/specs/2026-09-26-mobile-experience-redesign.md. Root checkout has unrelated active mobile changes; never modify it.

## Parallel wave 1
1. Discovery/navigation (Luna medium): own client home, explore, clinics, clinic detail, featured clinic cards, guest discovery/navigation and corresponding focused tests. Make real clinic cards discoverable and route to a combined detail preserving catalog context. Do not edit booking/auth/account/appointment/staff/locale files. Write failing focused test before behavior change and run only those focused tests.
2. Booking/auth handoff (Luna high): own guest booking draft helper, auth login/register/OTP/password recovery screens, client booking screens and corresponding focused tests. Preserve catalog context; avoid all payment creation/provider/backend changes. Write failing focused tests, then scoped implementation. Coordinate route contract with discovery.
3. Followup/account (Luna low): own client appointments/detail/rating/account/profile/records/settings, package/group navigation and corresponding focused tests. Add state-appropriate navigation and clear account entry points without new API or permissions. Do not edit home/explore/booking/auth/staff/locale files. Use focused tests.

## Integration by coordinator
- Coordinator owns locale JSON, any shared navigation contract, staff routes if they remain independent, conflicts, final verification and review dispatch.
- Route contract: clinic card -> /(client)/clinic/[id] with clinicId as route id; practitioner/service selection retains clinicId/serviceId/employeeId where relevant; guest booking draft retains existing serialized fields and is resumed at confirmation. Existing valid deep links remain supported.
- Workers preserve unrelated edits, never revert another worker, do not spawn children or run full build/lint/typecheck/test suites; only focused diagnostics.
- Review actual diff for spec and quality, run targeted Jest, mobile typecheck, targeted ESLint once after integration, then Sol independent review and remediate findings.

## Rulings
- Start from isolated catalog worktree rather than dirty root checkout, because catalog contract is a prerequisite and root has unrelated active edits. The branch diverged from root after base 35ec91de2; integration onto the later root branch is a separate operation.
