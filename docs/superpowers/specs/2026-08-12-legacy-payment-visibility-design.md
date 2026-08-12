# Legacy Payment Visibility Design

## Goal

Show the original Booknetic payment state on imported historical bookings and include trustworthy legacy collections in separate read-only statistics without creating operational invoices or payments.

## Data contract

Dashboard booking responses expose:

- `isHistoricalImport`: copied from `Booking.isHistoricalImport`.
- `historicalPayment`: a nullable read-only object sourced from the matching `LegacyImportRecord` for `sourceSystem=booknetic`, `entityType=APPOINTMENT`, and `targetId=booking.id`.
- `historicalPayment.status`: preserves the normalized source value: `paid`, `not_paid`, `pending`, `canceled`, or `unknown`.
- `historicalPayment.amount`: source `paidAmount` converted from SAR decimal text to integer halalas.
- `historicalPayment.method`: the original method text, or null.
- `historicalPayment.requiresReview`: true when a paid record belongs to a cancelled, expired, or no-show booking.

The operational `payment` and `invoice` fields remain unchanged. Legacy metadata is never projected into those fields.

## Dashboard behavior

- The bookings table displays the original state with a visible `Legacy system` marker.
- Historical booking details show the original amount, state, and method in a read-only payment card.
- Historical bookings do not offer payment recording, refund, invoice generation, lifecycle changes, rescheduling, cancellation, or deletion from the dashboard.
- Operational bookings retain their current behavior.

## Financial statistics

The existing payment statistics endpoint keeps operational totals unchanged and adds a nested `historical` summary:

- `collectedCount` and `collectedAmount`: source status `paid` on bookings whose mapped status is `CONFIRMED`.
- `reviewCount` and `reviewAmount`: source status `paid` on cancelled, expired, no-show, unlinked, or otherwise non-confirmed historical appointments.

Pending, not-paid, and canceled source payment states never count as collected revenue. The dashboard labels the historical totals separately and never adds them to operational revenue.

## Safety

- No Prisma schema or migration is needed.
- No legacy or production rows are updated or deleted.
- `EnsureBookingInvoiceHandler` rejects historical bookings, preventing a direct API call from materializing an operational invoice.
- Existing finance and communication counts remain untouched.

## Verification

- Backend mapper and handler tests cover source normalization, SAR-to-halalas conversion, review classification, list/detail loading, statistics classification, and invoice rejection.
- Dashboard tests cover historical badges, amounts, and disabled financial controls.
- Backend tests, dashboard tests, typecheck, lint, i18n parity, OpenAPI synchronization, and dashboard smoke are run before integration.
