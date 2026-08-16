# Website Pay-at-Clinic Design

## Goal

Allow an authenticated client booking through the public website to choose
between online payment through Moyasar and payment at the center. Bank transfer
is explicitly out of scope.

For the first release, pay-at-center is offered for every paid website booking,
including in-person and online delivery types. Restricting the option by
delivery type can be added later.

## Existing behavior

- The website creates an online booking and always initializes Moyasar when the
  backend returns an invoice.
- The core booking handler already supports `payAtClinic: true`, checks the
  organization setting, confirms the booking immediately, and skips invoice
  creation until the existing completion flow creates it.
- The public website DTO and controller do not currently accept or forward
  `payAtClinic`.

## Design

### Website

Add a required payment-method selection to the authenticated confirmation step:

- `ONLINE`: the current default; create the booking and initialize Moyasar when
  an invoice is returned.
- `AT_CENTER`: create the booking with `payAtClinic: true`; the confirmed
  response goes directly to the existing success state without a payment
  redirect.

The choice appears for all paid booking delivery types. Free bookings continue
to complete without a payment redirect. User-facing Arabic and English strings
use the website dictionary.

### API contract

Add optional boolean `payAtClinic` to `CreatePublicBookingDto` and forward it
from the public controller through `CreatePublicBookingHandler` to the existing
`CreateBookingHandler`.

The backend remains authoritative: if the organization has not enabled payment
at the center, it rejects `payAtClinic: true`. The website reports this as a
booking error and does not silently fall back to online payment.

Add an immutable Prisma migration that enables
`OrganizationSettings.paymentAtClinicEnabled` for the existing single-tenant
row and changes its database default to `true`. Align the Prisma schema default
and seed data. Administrators retain the existing dashboard toggle and can turn
the method off later.

### Financial behavior

- Online payment remains unchanged and uses Moyasar.
- Pay-at-center bookings are immediately `CONFIRMED`, carry
  `payAtClinic: true`, and do not receive a draft invoice at creation.
- The existing completion flow creates the invoice for a pay-at-center booking.
- No bank-transfer UI, endpoint, or payment record is added.

## Verification

- Backend DTO, public wrapper, and controller tests prove that `payAtClinic` is
  validated and forwarded.
- Website tests prove both branches: online payment initializes Moyasar, while
  pay-at-center reaches success without calling payment initialization.
- Regenerate the committed OpenAPI snapshot and dashboard generated types.
- Run focused backend and website tests, typechecks for affected workspaces, and
  dashboard smoke coverage required by the payment-sensitive project rules.

## Out of scope

- Bank transfer.
- Restricting pay-at-center to in-person appointments.
- Changing payment-at-center configuration screens or financial settlement at
  reception.
- Deployment.
