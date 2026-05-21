-- AddColumn: Employee.commissionRate
-- Decimal(5,4) accepts values up to 9.9999; we constrain to [0, 1] via a
-- CHECK constraint in the follow-up migration. DECIMAL(4,4) would max out
-- at 0.9999 and reject the 1.0 default below.
-- Default 1.0 (= 100%) so existing rows keep their full-invoice behaviour
-- until the org configures actual split rates.
ALTER TABLE "Employee"
  ADD COLUMN "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 1.0;

-- AddColumn: Service.commissionRateOverride
-- Nullable — null means "use Employee.commissionRate".
ALTER TABLE "Service"
  ADD COLUMN "commissionRateOverride" DECIMAL(5,4);
