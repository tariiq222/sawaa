-- prisma-no-transaction
-- Add composite indexes for cron query patterns (status + time columns)
-- booking-expiry: WHERE status IN (...) AND expiresAt < now()
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");
-- booking-autocomplete: WHERE status = CONFIRMED AND endsAt <= cutoff
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Booking_status_endsAt_idx" ON "Booking"("status", "endsAt");
-- booking-noshow + appointment-reminders: WHERE status = CONFIRMED AND scheduledAt ...
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Booking_status_scheduledAt_idx" ON "Booking"("status", "scheduledAt");
-- group-session-automation: WHERE status = OPEN AND scheduledAt <= now()
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GroupSession_status_scheduledAt_idx" ON "GroupSession"("status", "scheduledAt");
