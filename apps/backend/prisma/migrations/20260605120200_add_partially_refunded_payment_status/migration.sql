-- Add PARTIALLY_REFUNDED to the PaymentStatus enum.
--
-- Before this, a partial refund set Payment.status = REFUNDED outright, which
-- (a) was a lie — the payment still had an outstanding refundable balance — and
-- (b) made any *second* partial refund impossible: the state machine only
-- allowed COMPLETED → REFUNDED, so the second refund failed with
-- "Only completed payments can be refunded".
--
-- The invoice already tracked PARTIALLY_REFUNDED via InvoiceStatus; this brings
-- the Payment enum in line so a payment can be refunded across several partial
-- operations until fully refunded.
--
-- Additive enum value — safe and non-destructive. Postgres requires ALTER TYPE
-- ADD VALUE to run outside a transaction block; Prisma runs each migration
-- statement-by-statement so this is fine on its own.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
