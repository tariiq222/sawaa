-- Step 1: Delete duplicate hidden services, keeping the one with the earliest createdAt per categoryId.
-- If a categoryId has multiple hidden services, we keep the one referenced by bookings if any,
-- otherwise keep the oldest.
DELETE FROM "Service"
WHERE "isHidden" = true
  AND id NOT IN (
    SELECT DISTINCT ON ("categoryId") id
    FROM "Service"
    WHERE "isHidden" = true
      AND "categoryId" IS NOT NULL
    ORDER BY "categoryId",
             -- prefer rows referenced by bookings
             (EXISTS (SELECT 1 FROM "Booking" WHERE "Booking"."serviceId" = "Service"."id")) DESC,
             "createdAt" ASC
  )
  AND "categoryId" IS NOT NULL;

-- Step 2: Create partial unique index — one hidden service per category at most.
CREATE UNIQUE INDEX IF NOT EXISTS "Service_categoryId_hidden_unique"
  ON "Service" ("categoryId")
  WHERE "isHidden" = true;
