-- Add clientRescheduleMinHoursBefore to BookingSettings
ALTER TABLE "BookingSettings" ADD COLUMN "clientRescheduleMinHoursBefore" INTEGER NOT NULL DEFAULT 24;
