-- Phase 4 domain CHECK constraints.
--
-- This migration is intentionally SQL-only. It does not delete or modify data;
-- CHECK constraints will fail naturally if applied to a database containing
-- invalid rows.

DO $$
BEGIN
  -- Booking
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_durationMins_positive_chk') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_durationMins_positive_chk"
      CHECK ("durationMins" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_endsAt_after_scheduledAt_chk') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_endsAt_after_scheduledAt_chk"
      CHECK ("endsAt" > "scheduledAt");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_price_nonnegative_chk') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_price_nonnegative_chk"
      CHECK ("price" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_discountedPrice_range_chk') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_discountedPrice_range_chk"
      CHECK ("discountedPrice" IS NULL OR ("discountedPrice" >= 0 AND "discountedPrice" <= "price"));
  END IF;

  -- GroupSession
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupSession_durationMins_positive_chk') THEN
    ALTER TABLE "GroupSession"
      ADD CONSTRAINT "GroupSession_durationMins_positive_chk"
      CHECK ("durationMins" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupSession_maxCapacity_positive_chk') THEN
    ALTER TABLE "GroupSession"
      ADD CONSTRAINT "GroupSession_maxCapacity_positive_chk"
      CHECK ("maxCapacity" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupSession_enrolledCount_range_chk') THEN
    ALTER TABLE "GroupSession"
      ADD CONSTRAINT "GroupSession_enrolledCount_range_chk"
      CHECK ("enrolledCount" >= 0 AND "enrolledCount" <= "maxCapacity");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupSession_waitlistCount_nonnegative_chk') THEN
    ALTER TABLE "GroupSession"
      ADD CONSTRAINT "GroupSession_waitlistCount_nonnegative_chk"
      CHECK ("waitlistCount" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupSession_price_nonnegative_chk') THEN
    ALTER TABLE "GroupSession"
      ADD CONSTRAINT "GroupSession_price_nonnegative_chk"
      CHECK ("price" >= 0);
  END IF;

  -- BundlePurchase and BundleUsage
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BundlePurchase_amountPaid_nonnegative_chk') THEN
    ALTER TABLE "BundlePurchase"
      ADD CONSTRAINT "BundlePurchase_amountPaid_nonnegative_chk"
      CHECK ("amountPaid" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BundlePurchase_quantityTotal_nonnegative_chk') THEN
    ALTER TABLE "BundlePurchase"
      ADD CONSTRAINT "BundlePurchase_quantityTotal_nonnegative_chk"
      CHECK ("quantityTotal" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BundlePurchase_quantityUsed_range_chk') THEN
    ALTER TABLE "BundlePurchase"
      ADD CONSTRAINT "BundlePurchase_quantityUsed_range_chk"
      CHECK ("quantityUsed" >= 0 AND "quantityUsed" <= "quantityTotal");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BundleUsage_quantityUsed_positive_chk') THEN
    ALTER TABLE "BundleUsage"
      ADD CONSTRAINT "BundleUsage_quantityUsed_positive_chk"
      CHECK ("quantityUsed" > 0);
  END IF;

  -- Invoice
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_amounts_nonnegative_chk') THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_amounts_nonnegative_chk"
      CHECK (
        "subtotal" >= 0
        AND "discountAmt" >= 0
        AND "vatRate" >= 0
        AND "vatAmt" >= 0
        AND "total" >= 0
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_refundedAmount_range_chk') THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_refundedAmount_range_chk"
      CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "total");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_refundedVatAmt_range_chk') THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_refundedVatAmt_range_chk"
      CHECK ("refundedVatAmt" >= 0 AND "refundedVatAmt" <= "vatAmt");
  END IF;

  -- Payment and refunds
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_amount_positive_chk') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_amount_positive_chk"
      CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_refundedAmount_range_chk') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_refundedAmount_range_chk"
      CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "amount");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefundRequest_amount_positive_chk') THEN
    ALTER TABLE "RefundRequest"
      ADD CONSTRAINT "RefundRequest_amount_positive_chk"
      CHECK ("amount" > 0);
  END IF;

  -- Coupon
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_discountValue_nonnegative_chk') THEN
    ALTER TABLE "Coupon"
      ADD CONSTRAINT "Coupon_discountValue_nonnegative_chk"
      CHECK ("discountValue" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_percentage_discountValue_max_chk') THEN
    ALTER TABLE "Coupon"
      ADD CONSTRAINT "Coupon_percentage_discountValue_max_chk"
      CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_usedCount_nonnegative_chk') THEN
    ALTER TABLE "Coupon"
      ADD CONSTRAINT "Coupon_usedCount_nonnegative_chk"
      CHECK ("usedCount" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_maxUses_nonnegative_chk') THEN
    ALTER TABLE "Coupon"
      ADD CONSTRAINT "Coupon_maxUses_nonnegative_chk"
      CHECK ("maxUses" IS NULL OR "maxUses" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_usedCount_maxUses_chk') THEN
    ALTER TABLE "Coupon"
      ADD CONSTRAINT "Coupon_usedCount_maxUses_chk"
      CHECK ("maxUses" IS NULL OR "usedCount" <= "maxUses");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_maxUsesPerUser_positive_chk') THEN
    ALTER TABLE "Coupon"
      ADD CONSTRAINT "Coupon_maxUsesPerUser_positive_chk"
      CHECK ("maxUsesPerUser" IS NULL OR "maxUsesPerUser" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_minOrderAmt_nonnegative_chk') THEN
    ALTER TABLE "Coupon"
      ADD CONSTRAINT "Coupon_minOrderAmt_nonnegative_chk"
      CHECK ("minOrderAmt" IS NULL OR "minOrderAmt" >= 0);
  END IF;

  -- Rating
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Rating_score_range_chk') THEN
    ALTER TABLE "Rating"
      ADD CONSTRAINT "Rating_score_range_chk"
      CHECK ("score" BETWEEN 1 AND 5);
  END IF;

  -- Service and booking configuration
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_durationMins_positive_chk') THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_durationMins_positive_chk"
      CHECK ("durationMins" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_price_nonnegative_chk') THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_price_nonnegative_chk"
      CHECK ("price" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_depositAmount_nonnegative_chk') THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_depositAmount_nonnegative_chk"
      CHECK ("depositAmount" IS NULL OR "depositAmount" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_bufferMinutes_nonnegative_chk') THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_bufferMinutes_nonnegative_chk"
      CHECK ("bufferMinutes" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_lead_advance_nonnegative_chk') THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_lead_advance_nonnegative_chk"
      CHECK (
        ("minLeadMinutes" IS NULL OR "minLeadMinutes" >= 0)
        AND ("maxAdvanceDays" IS NULL OR "maxAdvanceDays" >= 0)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_participants_positive_chk') THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_participants_positive_chk"
      CHECK ("minParticipants" > 0 AND "maxParticipants" > 0 AND "minParticipants" <= "maxParticipants");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceBookingConfig_price_nonnegative_chk') THEN
    ALTER TABLE "ServiceBookingConfig"
      ADD CONSTRAINT "ServiceBookingConfig_price_nonnegative_chk"
      CHECK ("price" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceBookingConfig_durationMins_positive_chk') THEN
    ALTER TABLE "ServiceBookingConfig"
      ADD CONSTRAINT "ServiceBookingConfig_durationMins_positive_chk"
      CHECK ("durationMins" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceDurationOption_price_nonnegative_chk') THEN
    ALTER TABLE "ServiceDurationOption"
      ADD CONSTRAINT "ServiceDurationOption_price_nonnegative_chk"
      CHECK ("price" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceDurationOption_durationMins_positive_chk') THEN
    ALTER TABLE "ServiceDurationOption"
      ADD CONSTRAINT "ServiceDurationOption_durationMins_positive_chk"
      CHECK ("durationMins" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeServiceOption_priceOverride_nonnegative_chk') THEN
    ALTER TABLE "EmployeeServiceOption"
      ADD CONSTRAINT "EmployeeServiceOption_priceOverride_nonnegative_chk"
      CHECK ("priceOverride" IS NULL OR "priceOverride" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeServiceOption_durationOverride_positive_chk') THEN
    ALTER TABLE "EmployeeServiceOption"
      ADD CONSTRAINT "EmployeeServiceOption_durationOverride_positive_chk"
      CHECK ("durationOverride" IS NULL OR "durationOverride" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingSettings_numeric_ranges_chk') THEN
    ALTER TABLE "BookingSettings"
      ADD CONSTRAINT "BookingSettings_numeric_ranges_chk"
      CHECK (
        "bufferMinutes" >= 0
        AND "freeCancelBeforeHours" >= 0
        AND "lateCancelRefundPercent" >= 0
        AND "lateCancelRefundPercent" <= 100
        AND "maxReschedulesPerBooking" >= 0
        AND "autoCompleteAfterHours" >= 0
        AND "autoNoShowAfterMinutes" >= 0
        AND "minBookingLeadMinutes" >= 0
        AND "maxAdvanceBookingDays" >= 0
        AND "waitlistMaxPerSlot" >= 0
        AND "clientRescheduleMinHoursBefore" >= 0
      );
  END IF;

  -- Time and day ranges
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessHour_day_time_range_chk') THEN
    ALTER TABLE "BusinessHour"
      ADD CONSTRAINT "BusinessHour_day_time_range_chk"
      CHECK (
        "dayOfWeek" BETWEEN 0 AND 6
        AND "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "startTime" < "endTime"
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeAvailability_day_time_range_chk') THEN
    ALTER TABLE "EmployeeAvailability"
      ADD CONSTRAINT "EmployeeAvailability_day_time_range_chk"
      CHECK (
        "dayOfWeek" BETWEEN 0 AND 6
        AND "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "startTime" < "endTime"
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeBreak_day_time_range_chk') THEN
    ALTER TABLE "EmployeeBreak"
      ADD CONSTRAINT "EmployeeBreak_day_time_range_chk"
      CHECK (
        "dayOfWeek" BETWEEN 0 AND 6
        AND "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "startTime" < "endTime"
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeAvailabilityException_endDate_gte_startDate_chk') THEN
    ALTER TABLE "EmployeeAvailabilityException"
      ADD CONSTRAINT "EmployeeAvailabilityException_endDate_gte_startDate_chk"
      CHECK ("endDate" >= "startDate");
  END IF;
END $$;
