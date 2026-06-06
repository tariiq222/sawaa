/**
 * Feature Keys — tiered feature flags for Sawaa SaaS.
 *
 * PRO+ flags are on/off boolean gates.
 * ENTERPRISE-only flags are also on/off.
 * Quantitative keys carry both a flag (enabled/disabled) and a numeric limit.
 *
 * This const is the single source of truth consumed by:
 *   - FeatureGuard  (backend enforcement)
 *   - GetMyFeaturesHandler  (billing features endpoint)
 *   - useBillingFeatures / useSidebarNav  (dashboard)
 */
export const FeatureKey = {
  // ── On/Off — PRO+ ────────────────────────────────────────────────
  RECURRING_BOOKINGS: "recurring_bookings",
  WAITLIST: "waitlist",
  GROUP_SESSIONS: "group_sessions",
  AI_CHATBOT: "ai_chatbot",
  EMAIL_TEMPLATES: "email_templates",
  COUPONS: "coupons",

  // ── On/Off — ENTERPRISE only ──────────────────────────────────────
  ADVANCED_REPORTS: "advanced_reports",
  INTAKE_FORMS: "intake_forms",
  CUSTOM_ROLES: "custom_roles",
  ACTIVITY_LOG: "activity_log",

  // ── Quantitative (flag + numeric limit) ───────────────────────────
  BRANCHES: "branches",
  EMPLOYEES: "employees",
  SERVICES: "services",
  MONTHLY_BOOKINGS: "monthly_bookings",

  // ── On/Off — PRO (Phase 3) ────────────────────────────────────────
  ZOOM_INTEGRATION: "zoom_integration",
  ZOHO_INVOICE_INTEGRATION: "zoho_invoice_integration",
  WALK_IN_BOOKINGS: "walk_in_bookings",
  BANK_TRANSFER_PAYMENTS: "bank_transfer_payments",
  MULTI_BRANCH: "multi_branch",
  DEPARTMENTS: "departments",
  CLIENT_RATINGS: "client_ratings",
  DATA_EXPORT: "data_export",

  // ── On/Off — ENTERPRISE (Phase 3) ────────────────────────────────
  SMS_PROVIDER_DEDICATED: "sms_provider_per_tenant",
  SMS_PROVIDER_PER_TENANT: "sms_provider_per_tenant",
  WHITE_LABEL_MOBILE: "white_label_mobile",
  CUSTOM_DOMAIN: "custom_domain",
  API_ACCESS: "api_access",
  WEBHOOKS: "webhooks",
  PRIORITY_SUPPORT: "priority_support",
  AUDIT_EXPORT: "audit_export",
  MULTI_CURRENCY: "multi_currency",
  // ── Quantitative — email/SMS fallback quotas (Phase settings-hub) ─────
  EMAIL_FALLBACK_MONTHLY: 'email_fallback_monthly',
  SMS_FALLBACK_MONTHLY: 'sms_fallback_monthly',
} as const;

export type FeatureKey = (typeof FeatureKey)[keyof typeof FeatureKey];
