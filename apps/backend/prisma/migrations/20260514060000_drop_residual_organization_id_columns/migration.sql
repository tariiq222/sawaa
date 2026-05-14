-- Drop residual organizationId columns from 62 tables.
--
-- The earlier single-tenant migration (20260513200000_sawa_single_tenant_drop_orgid)
-- only dropped organizationId from ProblemReport and Integration. The Prisma schema
-- removed the field from all models, but the underlying columns still exist as
-- NOT NULL — so any INSERT against the bare client (e.g. seed.ts BrandingConfig)
-- fails with NullConstraintViolation.
--
-- This migration drops the dangling columns + all their constraints/indexes.
-- CASCADE handles foreign keys and dependent indexes in one shot.

-- Add missing PRIMARY KEY on SiteSetting (the initial migration created the
-- column but never added the constraint; drift was masked until now).
ALTER TABLE "SiteSetting" DROP CONSTRAINT IF EXISTS "SiteSetting_pkey";
ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key");

-- Drop legacy User.lastActiveOrganizationId column (multi-tenant remnant —
-- already removed from the Prisma schema but still in DB).
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastActiveOrganizationId";

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'ActivityLog', 'Booking', 'BookingSettings', 'BookingStatusLog', 'Branch',
    'BrandingConfig', 'BusinessHour', 'ChatConversation', 'ChatMessage',
    'ChatSession', 'ChatbotConfig', 'Client', 'ClientRefreshToken',
    'CommsChatMessage', 'ContactMessage', 'Coupon', 'CouponRedemption',
    'CustomRole', 'Department', 'DocumentChunk', 'EmailTemplate',
    'EmailVerificationToken', 'Employee', 'EmployeeAvailability',
    'EmployeeAvailabilityException', 'EmployeeBranch', 'EmployeeBreak',
    'EmployeeService', 'EmployeeServiceOption', 'FcmToken', 'File',
    'GroupEnrollment', 'GroupSession', 'GroupSessionWaitlist', 'Holiday',
    'IntakeField', 'IntakeForm', 'Invoice', 'KnowledgeDocument', 'Notification',
    'NotificationDeliveryLog', 'OrganizationEmailConfig',
    'OrganizationPaymentConfig', 'OrganizationSettings', 'OrganizationSmsConfig',
    'OtpCode', 'PasswordHistory', 'Payment', 'Permission', 'PlatformEmailLog',
    'Rating', 'RefreshToken', 'RefundRequest', 'Report', 'Service',
    'ServiceBookingConfig', 'ServiceCategory', 'ServiceDurationOption',
    'SiteSetting', 'SmsDelivery', 'UsedOtpSession', 'WaitlistEntry'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE %I DROP COLUMN IF EXISTS %I CASCADE',
      tbl, 'organizationId'
    );
  END LOOP;
END $$;
