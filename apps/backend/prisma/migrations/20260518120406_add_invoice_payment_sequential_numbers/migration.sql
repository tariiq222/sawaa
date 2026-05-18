-- ============================================================
-- Migration: add_invoice_payment_sequential_numbers
-- Created:   2026-05-18
--
-- PURPOSE:
--   Add human-readable sequential numbers to Invoice and Payment
--   models. These replace truncated UUIDs in the dashboard UI
--   (e.g. "INV-0001", "PAY-0001").
--
-- SCHEMA IMPACT:
--   - Invoice: add `number` (Int, unique, autoincrement)
--   - Payment: add `number` (Int, unique, autoincrement)
-- ============================================================

-- Add sequential number to Invoice
CREATE SEQUENCE invoice_number_seq;
ALTER TABLE "Invoice" ADD COLUMN "number" INTEGER NOT NULL DEFAULT nextval('invoice_number_seq');
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
ALTER SEQUENCE invoice_number_seq OWNED BY "Invoice"."number";

-- Add sequential number to Payment
CREATE SEQUENCE payment_number_seq;
ALTER TABLE "Payment" ADD COLUMN "number" INTEGER NOT NULL DEFAULT nextval('payment_number_seq');
CREATE UNIQUE INDEX "Payment_number_key" ON "Payment"("number");
ALTER SEQUENCE payment_number_seq OWNED BY "Payment"."number";
