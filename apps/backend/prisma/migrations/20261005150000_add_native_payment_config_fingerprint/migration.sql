-- Nullable identity of the public native SDK configuration used for a reservation.
-- No backfill: legacy/hosted attempts remain NULL. Deployment is a separate step.
ALTER TABLE "Payment" ADD COLUMN "nativeConfigFingerprint" TEXT;
