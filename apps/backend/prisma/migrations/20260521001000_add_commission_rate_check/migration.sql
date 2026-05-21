-- Migration: 20260521001000_add_commission_rate_check
--
-- Adds CHECK constraints to enforce that commission rates stay within [0, 1].
--
-- DEPENDENCY: This migration MUST be applied AFTER
-- 20260521000000_add_commission_split (PR #22), which added the
-- Employee.commissionRate and Service.commissionRateOverride columns.
-- Applying this migration against a database that does not yet have those
-- columns will fail with a "column does not exist" error.

-- Employee commission rate must be in [0, 1] (0% – 100%).
ALTER TABLE "Employee"
  ADD CONSTRAINT "employee_commission_rate_range"
  CHECK ("commissionRate" >= 0 AND "commissionRate" <= 1);

-- Service override must also be in [0, 1] when provided (nullable = use employee default).
ALTER TABLE "Service"
  ADD CONSTRAINT "service_commission_override_range"
  CHECK ("commissionRateOverride" IS NULL OR ("commissionRateOverride" >= 0 AND "commissionRateOverride" <= 1));
