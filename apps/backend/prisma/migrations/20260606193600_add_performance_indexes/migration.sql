-- Additive performance indexes for booking availability, dashboard listings, and cron scans.
CREATE INDEX "Booking_employeeId_status_scheduledAt_idx" ON "Booking"("employeeId", "status", "scheduledAt");
CREATE INDEX "Booking_employeeId_status_endsAt_idx" ON "Booking"("employeeId", "status", "endsAt");
CREATE INDEX "Booking_branchId_scheduledAt_idx" ON "Booking"("branchId", "scheduledAt");
CREATE INDEX "Booking_serviceId_scheduledAt_idx" ON "Booking"("serviceId", "scheduledAt");

CREATE INDEX "Employee_isPublic_isActive_createdAt_idx" ON "Employee"("isPublic", "isActive", "createdAt");

CREATE INDEX "Invoice_status_createdAt_idx" ON "Invoice"("status", "createdAt");
CREATE INDEX "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status", "createdAt");

CREATE INDEX "Rating_employeeId_createdAt_idx" ON "Rating"("employeeId", "createdAt");
CREATE INDEX "Rating_clientId_createdAt_idx" ON "Rating"("clientId", "createdAt");
