# Paid program checkout repair

Approved scope: repair the complete existing in-person program enrollment/payment journey requested by the owner on 2026-09-22. Do not undertake the unrelated App Store audit findings.

The mobile app must not announce successful enrollment for an unpaid program. Enrollment reserves one seat and creates one booking/invoice; payment uses the existing authenticated Moyasar hosted checkout. Retries and reopening reuse those records. Only authoritative server invoice and booking state can confirm payment/enrollment. Browser return parameters never prove payment. Cancellation, failure, delayed notifications and expired bookings have explicit recoverable states. Free programs retain immediate enrollment.

The return path is a fixed HTTPS website callback that can open `sawa://booking/payment-callback?bookingId=...&invoiceId=...`. That app route resumes an existing-booking checkout; it must not create an individual booking. Website-only callers retain their current callback behavior.

Constraints: integer halalas; default VAT 0; physical in-person services; existing Moyasar provider configuration; no auth/guard/credential/encryption/migration changes. Arabic-first existing design, client wording موعد. Preserve unrelated changes. No commits, pushes, merges or deployments. Mobile commands run via its separate workspace. Final evidence must distinguish local automated tests, real PostgreSQL integration, dashboard smoke, real Moyasar sandbox, and native-device Apple Pay.

Acceptance: paid enrollment routes to invoice checkout; double submit/concurrent enrollment creates one seat/booking/invoice; existing active enrollment is resumable even when full; free enrollment succeeds without checkout; cancelled/expired states never appear successful; pending webhook keeps checking or offers recheck; failed attempt does not poison later successful attempt; reopening from appointments can complete payment; fixed callback returns to the correct existing booking; no fabricated scheduled date for an unscheduled program; unit and relevant integration/regression checks pass with external gates reported honestly.
