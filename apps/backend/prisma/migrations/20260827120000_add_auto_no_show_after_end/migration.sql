-- Additive: introduce autoNoShowAfterEnd toggle on BookingSettings.
-- Default true so the auto-no-show grace is measured from the appointment
-- end (endsAt + autoNoShowAfterMinutes) instead of the start (scheduledAt +
-- autoNoShowAfterMinutes) — stops mid-session auto-no-shows when reception
-- forgets check-in. Staff can flip to false to keep the legacy start-based
-- grace.

ALTER TABLE "BookingSettings"
ADD COLUMN "autoNoShowAfterEnd" BOOLEAN NOT NULL DEFAULT true;
