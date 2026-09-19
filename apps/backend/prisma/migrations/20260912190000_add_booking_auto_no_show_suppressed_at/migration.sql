-- Keep real attendance distinct from a staff override of automatic no-show.
ALTER TABLE "Booking" ADD COLUMN "autoNoShowSuppressedAt" TIMESTAMP(3);
