-- Per-practitioner buffer (minutes) between appointments for a service assignment.
ALTER TABLE "EmployeeService" ADD COLUMN "bufferMinutes" INTEGER NOT NULL DEFAULT 0;
