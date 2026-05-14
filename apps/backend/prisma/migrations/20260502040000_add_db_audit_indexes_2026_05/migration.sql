-- Migration: add_db_audit_indexes_2026_05
-- DB-05: Composite @@unique([id, organizationId]) on 11 parent tables
-- DB-06: Evidence-backed composite indexes (EXPLAIN ANALYZE in docs/architecture/index-audit-2026-05.md)
-- DB-07: Drop redundant Booking(employeeId) index

-- ─── DB-05: Composite uniques ────────────────────────────────────────────────

-- Booking
CREATE UNIQUE INDEX "booking_id_org" ON "Booking"("id", "organizationId");

-- GroupSession
CREATE UNIQUE INDEX "group_session_id_org" ON "GroupSession"("id", "organizationId");

-- Invoice
CREATE UNIQUE INDEX "invoice_id_org" ON "Invoice"("id", "organizationId");

-- Branch
CREATE UNIQUE INDEX "branch_id_org" ON "Branch"("id", "organizationId");

-- Department
CREATE UNIQUE INDEX "department_id_org" ON "Department"("id", "organizationId");

-- ServiceCategory
CREATE UNIQUE INDEX "service_category_id_org" ON "ServiceCategory"("id", "organizationId");

-- Service
CREATE UNIQUE INDEX "service_id_org" ON "Service"("id", "organizationId");

-- IntakeForm
CREATE UNIQUE INDEX "intake_form_id_org" ON "IntakeForm"("id", "organizationId");

-- Employee
CREATE UNIQUE INDEX "employee_id_org" ON "Employee"("id", "organizationId");

-- Client
CREATE UNIQUE INDEX "client_id_org" ON "Client"("id", "organizationId");

-- CustomRole
CREATE UNIQUE INDEX "custom_role_id_org" ON "CustomRole"("id", "organizationId");

-- ─── DB-06: Hot-path composite indexes ───────────────────────────────────────

-- Notification(recipientId, isRead, createdAt) — replaces (recipientId, createdAt)
-- Evidence: bitmap heap scan removing 34% of rows as isRead filter
DROP INDEX IF EXISTS "Notification_recipientId_createdAt_idx";
CREATE INDEX "Notification_recipientId_isRead_createdAt_idx" ON "Notification"("recipientId", "isRead", "createdAt");

-- Invoice(organizationId, status, dueAt) — AR aging query was 30ms
CREATE INDEX "Invoice_organizationId_status_dueAt_idx" ON "Invoice"("organizationId", "status", "dueAt");

-- ActivityLog(organizationId, occurredAt) — replaces (organizationId) + (occurredAt)
DROP INDEX IF EXISTS "ActivityLog_organizationId_idx";
DROP INDEX IF EXISTS "ActivityLog_occurredAt_idx";
CREATE INDEX "ActivityLog_organizationId_occurredAt_idx" ON "ActivityLog"("organizationId", "occurredAt");

-- SmsDelivery(status, createdAt) — replaces (status) + (createdAt)
DROP INDEX IF EXISTS "SmsDelivery_status_idx";
DROP INDEX IF EXISTS "SmsDelivery_createdAt_idx";
CREATE INDEX "SmsDelivery_status_createdAt_idx" ON "SmsDelivery"("status", "createdAt");

-- NotificationDeliveryLog(status, createdAt) — replaces standalone (createdAt)
DROP INDEX IF EXISTS "NotificationDeliveryLog_createdAt_idx";
CREATE INDEX "NotificationDeliveryLog_status_createdAt_idx" ON "NotificationDeliveryLog"("status", "createdAt");

-- ─── DB-07: Drop redundant Booking(employeeId) index ─────────────────────────
-- Rationale: [employeeId, scheduledAt] and [employeeId, endsAt] cover all
-- single-column employeeId queries as leading-prefix scans.
DROP INDEX IF EXISTS "Booking_employeeId_idx";
