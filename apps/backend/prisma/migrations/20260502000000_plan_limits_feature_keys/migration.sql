-- SaaS-04 patch — add feature-key flags to plan limits JSON.
-- The initial seed (20260422170201) used camelCase keys (chatbotEnabled, zatcaEnabled, …).
-- GetMyFeaturesHandler reads snake_case keys from FEATURE_KEY_MAP (recurring_bookings,
-- ai_chatbot, zatca, waitlist, …). Without these keys planLimitValue is undefined,
-- causing `undefined !== 0` → true for every boolean feature.
-- This migration merges the canonical feature-key set into each plan's limits column.
-- Idempotent: jsonb merge (||) is safe to re-apply.

UPDATE "Plan"
SET limits = limits || '{
  "recurring_bookings": false,
  "waitlist": false,
  "group_sessions": false,
  "ai_chatbot": false,
  "email_templates": true,
  "coupons": false,
  "advanced_reports": false,
  "intake_forms": true,
  "zatca": false,
  "custom_roles": false,
  "activity_log": false
}'::jsonb
WHERE slug = 'BASIC';

UPDATE "Plan"
SET limits = limits || '{
  "recurring_bookings": true,
  "waitlist": true,
  "group_sessions": false,
  "ai_chatbot": true,
  "email_templates": true,
  "coupons": true,
  "advanced_reports": false,
  "intake_forms": true,
  "zatca": true,
  "custom_roles": false,
  "activity_log": false
}'::jsonb
WHERE slug = 'PRO';

UPDATE "Plan"
SET limits = limits || '{
  "recurring_bookings": true,
  "waitlist": true,
  "group_sessions": true,
  "ai_chatbot": true,
  "email_templates": true,
  "coupons": true,
  "advanced_reports": true,
  "intake_forms": true,
  "zatca": true,
  "custom_roles": true,
  "activity_log": true
}'::jsonb
WHERE slug = 'ENTERPRISE';
