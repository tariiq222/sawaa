-- saas-rls-hardening: normalize every tenant_isolation policy onto
-- app_current_org_id() and add WITH CHECK so writes cannot create
-- cross-tenant rows even if the Prisma extension is bypassed.
-- Issued: 2026-04-25. Owner-only review tier (CLAUDE.md security tier).
--
-- Rename decision: policies that older migrations created with the bare
-- name "tenant_isolation" (02e finance, 02f comms, 02g ai/media/ops/platform,
-- 02g-sms, 02h booking-cluster backfill, password_history) are renamed to
-- the suffixed `tenant_isolation_<snake_case_table>` form for clarity.
-- Policies that already had a suffixed name (02a identity, 02b people,
-- 02c org-config) keep their original names.
--
-- The `OR app_current_org_id() IS NULL` clause is preserved in both USING
-- and WITH CHECK — this is the intentional super-admin bypass when the
-- per-transaction `app.current_org_id` GUC is unset (RlsHelper.runWithoutTenant).

-- ================== identity (02a) ==================
DROP POLICY IF EXISTS tenant_isolation_refresh_token ON "RefreshToken";
CREATE POLICY tenant_isolation_refresh_token ON "RefreshToken"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_custom_role ON "CustomRole";
CREATE POLICY tenant_isolation_custom_role ON "CustomRole"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_permission ON "Permission";
CREATE POLICY tenant_isolation_permission ON "Permission"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ================== people (02b) ==================
DROP POLICY IF EXISTS tenant_isolation_client ON "Client";
CREATE POLICY tenant_isolation_client ON "Client"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_client_refresh_token ON "ClientRefreshToken";
CREATE POLICY tenant_isolation_client_refresh_token ON "ClientRefreshToken"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_employee ON "Employee";
CREATE POLICY tenant_isolation_employee ON "Employee"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_employee_branch ON "EmployeeBranch";
CREATE POLICY tenant_isolation_employee_branch ON "EmployeeBranch"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_employee_service ON "EmployeeService";
CREATE POLICY tenant_isolation_employee_service ON "EmployeeService"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_employee_availability ON "EmployeeAvailability";
CREATE POLICY tenant_isolation_employee_availability ON "EmployeeAvailability"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_employee_availability_exception ON "EmployeeAvailabilityException";
CREATE POLICY tenant_isolation_employee_availability_exception ON "EmployeeAvailabilityException"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- PasswordHistory came in via 20260422171000_add_password_history with the
-- bare name "tenant_isolation" — rename to suffixed form.
DROP POLICY IF EXISTS "tenant_isolation" ON "PasswordHistory";
CREATE POLICY tenant_isolation_password_history ON "PasswordHistory"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ================== org-config + org-experience (02c) ==================
DROP POLICY IF EXISTS tenant_isolation_branch ON "Branch";
CREATE POLICY tenant_isolation_branch ON "Branch"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_department ON "Department";
CREATE POLICY tenant_isolation_department ON "Department"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_service_category ON "ServiceCategory";
CREATE POLICY tenant_isolation_service_category ON "ServiceCategory"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_service ON "Service";
CREATE POLICY tenant_isolation_service ON "Service"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_service_booking_config ON "ServiceBookingConfig";
CREATE POLICY tenant_isolation_service_booking_config ON "ServiceBookingConfig"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_service_duration_option ON "ServiceDurationOption";
CREATE POLICY tenant_isolation_service_duration_option ON "ServiceDurationOption"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_employee_service_option ON "EmployeeServiceOption";
CREATE POLICY tenant_isolation_employee_service_option ON "EmployeeServiceOption"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_business_hour ON "BusinessHour";
CREATE POLICY tenant_isolation_business_hour ON "BusinessHour"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_holiday ON "Holiday";
CREATE POLICY tenant_isolation_holiday ON "Holiday"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_branding_config ON "BrandingConfig";
CREATE POLICY tenant_isolation_branding_config ON "BrandingConfig"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_intake_form ON "IntakeForm";
CREATE POLICY tenant_isolation_intake_form ON "IntakeForm"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_intake_field ON "IntakeField";
CREATE POLICY tenant_isolation_intake_field ON "IntakeField"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_rating ON "Rating";
CREATE POLICY tenant_isolation_rating ON "Rating"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS tenant_isolation_organization_settings ON "OrganizationSettings";
CREATE POLICY tenant_isolation_organization_settings ON "OrganizationSettings"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ================== bookings (02d, policies added in 02h) ==================
DROP POLICY IF EXISTS "tenant_isolation" ON "Booking";
CREATE POLICY tenant_isolation_booking ON "Booking"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "BookingStatusLog";
CREATE POLICY tenant_isolation_booking_status_log ON "BookingStatusLog"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "WaitlistEntry";
CREATE POLICY tenant_isolation_waitlist_entry ON "WaitlistEntry"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "GroupSession";
CREATE POLICY tenant_isolation_group_session ON "GroupSession"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "GroupEnrollment";
CREATE POLICY tenant_isolation_group_enrollment ON "GroupEnrollment"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "GroupSessionWaitlist";
CREATE POLICY tenant_isolation_group_session_waitlist ON "GroupSessionWaitlist"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "BookingSettings";
CREATE POLICY tenant_isolation_booking_settings ON "BookingSettings"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ================== finance (02e) ==================
DROP POLICY IF EXISTS "tenant_isolation" ON "Invoice";
CREATE POLICY tenant_isolation_invoice ON "Invoice"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "Payment";
CREATE POLICY tenant_isolation_payment ON "Payment"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "Coupon";
CREATE POLICY tenant_isolation_coupon ON "Coupon"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "CouponRedemption";
CREATE POLICY tenant_isolation_coupon_redemption ON "CouponRedemption"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "RefundRequest";
CREATE POLICY tenant_isolation_refund_request ON "RefundRequest"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ZatcaSubmission";
CREATE POLICY tenant_isolation_zatca_submission ON "ZatcaSubmission"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ZatcaConfig";
CREATE POLICY tenant_isolation_zatca_config ON "ZatcaConfig"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ================== comms (02f) ==================
DROP POLICY IF EXISTS "tenant_isolation" ON "Notification";
CREATE POLICY tenant_isolation_notification ON "Notification"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ChatConversation";
CREATE POLICY tenant_isolation_chat_conversation ON "ChatConversation"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "CommsChatMessage";
CREATE POLICY tenant_isolation_comms_chat_message ON "CommsChatMessage"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ContactMessage";
CREATE POLICY tenant_isolation_contact_message ON "ContactMessage"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "EmailTemplate";
CREATE POLICY tenant_isolation_email_template ON "EmailTemplate"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ChatSession";
CREATE POLICY tenant_isolation_chat_session ON "ChatSession"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ChatMessage";
CREATE POLICY tenant_isolation_chat_message ON "ChatMessage"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ChatbotConfig";
CREATE POLICY tenant_isolation_chatbot_config ON "ChatbotConfig"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ================== ai + media + ops + platform + content (02g) ==================
DROP POLICY IF EXISTS "tenant_isolation" ON "KnowledgeDocument";
CREATE POLICY tenant_isolation_knowledge_document ON "KnowledgeDocument"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "DocumentChunk";
CREATE POLICY tenant_isolation_document_chunk ON "DocumentChunk"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "File";
CREATE POLICY tenant_isolation_file ON "File"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ActivityLog";
CREATE POLICY tenant_isolation_activity_log ON "ActivityLog"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "Report";
CREATE POLICY tenant_isolation_report ON "Report"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "ProblemReport";
CREATE POLICY tenant_isolation_problem_report ON "ProblemReport"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "Integration";
CREATE POLICY tenant_isolation_integration ON "Integration"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "FeatureFlag";
CREATE POLICY tenant_isolation_feature_flag ON "FeatureFlag"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "SiteSetting";
CREATE POLICY tenant_isolation_site_setting ON "SiteSetting"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ================== per-tenant SMS (02g-sms) ==================
DROP POLICY IF EXISTS "tenant_isolation" ON "OrganizationSmsConfig";
CREATE POLICY tenant_isolation_organization_sms_config ON "OrganizationSmsConfig"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

DROP POLICY IF EXISTS "tenant_isolation" ON "SmsDelivery";
CREATE POLICY tenant_isolation_sms_delivery ON "SmsDelivery"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
