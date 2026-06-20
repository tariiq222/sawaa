-- Per-practitioner custom pricing mode.
-- When true, only ServiceDurationOption rows owned by this practitioner (employeeServiceId=link.id)
-- are offered for booking. Types with no owned options are hidden entirely.
ALTER TABLE "EmployeeService" ADD COLUMN "useCustomPricing" BOOLEAN NOT NULL DEFAULT false;
