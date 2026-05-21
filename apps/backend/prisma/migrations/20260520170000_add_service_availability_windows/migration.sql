-- Add optional service-level custom availability windows per delivery type.
-- This migration only changes schema; it does not apply anything to production.

ALTER TABLE "ServiceBookingConfig"
    ADD COLUMN "useCustomAvailability" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ServiceAvailabilityWindow" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "deliveryType" "DeliveryType" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAvailabilityWindow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceAvailabilityWindow_dayOfWeek_chk" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
    CONSTRAINT "ServiceAvailabilityWindow_time_format_chk" CHECK (
        "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "startTime" < "endTime"
    )
);

ALTER TABLE "ServiceAvailabilityWindow"
    ADD CONSTRAINT "ServiceAvailabilityWindow_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ServiceAvailabilityWindow_serviceId_idx"
    ON "ServiceAvailabilityWindow"("serviceId");

CREATE INDEX "ServiceAvailabilityWindow_serviceId_deliveryType_dayOfWeek_idx"
    ON "ServiceAvailabilityWindow"("serviceId", "deliveryType", "dayOfWeek");
