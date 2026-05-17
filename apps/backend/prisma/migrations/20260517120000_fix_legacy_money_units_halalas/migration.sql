-- ============================================================
-- Migration: fix_legacy_money_units_halalas
-- Created:   2026-05-17
--
-- PURPOSE:
--   Legacy Invoice and Payment rows (all 3 357 rows created before the
--   price-unit unification) store money in SAR-major units (e.g. 200)
--   instead of integer halalas (e.g. 20 000).  Every other table
--   (Booking, Service) is already correct (halalas).
--
-- FIX:
--   Multiply Invoice.subtotal and Invoice.total by 100 where they are
--   still in SAR-major units, then multiply Payment.amount by 100 where
--   it is still in SAR-major units.
--
-- IDEMPOTENCY GUARD (safe to run twice):
--   Invoice UPDATE: only multiplies a row when its current `total` does
--   NOT yet equal the related Booking.price (i.e. it is still the old
--   SAR-major value).  Because total * 100 = Booking.price is the
--   expected "off by 100×" signature, the WHERE clause is:
--       i."total" * 100 = b."price"   -- still SAR-major
--   AND i."total" <> b."price"        -- not already corrected
--
--   Payment UPDATE: only multiplies a row when its current `amount` does
--   NOT yet match the (now-corrected) Invoice.total.  The WHERE clause:
--       p."amount" * 100 = i."total"  -- still SAR-major relative to invoice
--   AND p."amount" <> i."total"       -- not already corrected
--
--   NOTE on ordering: the Invoice UPDATE runs FIRST so that by the time
--   the Payment UPDATE runs, Invoice.total already reflects halalas.
--   The Payment guard therefore correctly compares against the already-
--   multiplied invoice total.
--
-- SCHEMA IMPACT: none — pure data migration, no DDL.
-- DO NOT TOUCH: Booking, Service, or any other table.
-- ============================================================

-- Step 1: Fix Invoice amounts (subtotal and total) where still SAR-major.
UPDATE "Invoice" i
SET
  "subtotal" = i."subtotal" * 100,
  "total"    = i."total"    * 100
FROM "Booking" b
WHERE i."bookingId" = b."id"
  AND i."total" * 100 = b."price"   -- still SAR-major: total × 100 equals the correct halala price
  AND i."total" <> b."price";       -- guard: skip rows already in halalas

-- Step 2: Fix Payment amounts where still SAR-major.
--         Runs AFTER the Invoice fix so i."total" is already in halalas.
UPDATE "Payment" p
SET "amount" = p."amount" * 100
FROM "Invoice" i
WHERE p."invoiceId" = i."id"
  AND p."amount" * 100 = i."total"  -- still SAR-major: amount × 100 equals the (now-corrected) invoice total
  AND p."amount" <> i."total";      -- guard: skip rows already in halalas
