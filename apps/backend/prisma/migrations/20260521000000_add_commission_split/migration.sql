-- AddColumn: Employee.commissionRate
-- Default 1.0 (= 100%) so existing rows keep their full-invoice behaviour
-- until the org configures actual split rates.
ALTER TABLE "Employee"
  ADD COLUMN "commissionRate" DECIMAL(4,4) NOT NULL DEFAULT 1.0;

-- AddColumn: Service.commissionRateOverride
-- Nullable — null means "use Employee.commissionRate".
ALTER TABLE "Service"
  ADD COLUMN "commissionRateOverride" DECIMAL(4,4);
