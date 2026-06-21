-- Make Booking.serviceId nullable so GROUP bookings can reference programId instead.
-- Individual bookings continue to populate serviceId as before.
ALTER TABLE "Booking" ALTER COLUMN "serviceId" DROP NOT NULL;
