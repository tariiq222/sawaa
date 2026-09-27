# Sawaa mobile experience redesign

Approved source: mobile-flow proposal prepared 2026-09-26 in the visualizations workspace. Implement in the existing isolated clinic-catalog worktree.

## Intended experience
- One client navigation structure: Home, Appointments, Explore, Account. Guest navigation uses the same four destinations; keep staff routes isolated.
- Home presents search, the next appointment when available, and actual clinic cards without duplicate catalog sections. Explore is the categorized directory for clinics, services, practitioners, packages, and programs.
- Clinic detail combines clinic explanation and its services/practitioners. Direct clinics go to practitioner selection; service clinics require the real service. Keep clinicId, serviceId, employeeId through booking.
- Guest authentication returns to the same booking draft through login, registration, OTP and password recovery. Do not create bookings before authenticated confirmation.
- Booking and payment status labels reflect confirmed, pending, failed, cancelled and expired server states. Never imply payment from browser return alone or create a fresh booking on payment retry.
- Appointments provide state-appropriate actions, including rating when eligible. Account gives clear access to profile, packages, records, settings and support. Preserve existing backend authorization and payment behavior.
- Group programs and package purchase remain distinct from individual booking; staff experience remains separate.

## Constraints and acceptance
- The mobile appointment read contract may add DB-backed `hasRated` so the rating action reflects server state; its existing `type` identifies group appointments. No booking mutation, auth guard, payment creation/refund/Moyasar, schema, or provider contract changes are in this plan.
- Follow apps/mobile/CLAUDE.md: query hooks, i18n, theme tokens, client/staff separation, file length limit and accessibility.
- Preserve unrelated working-tree changes; no commit, push, merge or deploy under this request.
- Verify navigation and context with focused tests, mobile typecheck and targeted lint; manually inspect representative client flows if a simulator is available. Call any unrun device or provider path unverified.
