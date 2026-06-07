-- Allow employee-service assignments to be toggled without deleting pricing/options.
ALTER TABLE "EmployeeService" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
