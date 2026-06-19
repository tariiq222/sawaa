-- Migration: 20260619000000_employee_duration_options
-- Add nullable employeeServiceId to ServiceDurationOption.
-- NULL = service-level default; non-null = owned by that EmployeeService.
-- This is a cross-BC plain string (no FK), so it is additive-only and safe.

ALTER TABLE "ServiceDurationOption" ADD COLUMN "employeeServiceId" TEXT;

CREATE INDEX "ServiceDurationOption_employeeServiceId_idx" ON "ServiceDurationOption"("employeeServiceId");
