-- Phase 1 / Bug B3 — Seed the 15 Phase-3 boolean feature keys into every
-- Plan.limits row so FeatureGuard's enforcement matches the FEATURE_CATALOG
-- shipped in PRs #99–#104. Without these keys, BASIC plans were silently
-- accessing PRO/ENTERPRISE-tier features because Plan.limits[jsonKey] was
-- `undefined` and the boolean truthy check fell through to `return true`.
--
-- This migration also:
--   1. Flips BASIC.intake_forms to false (catalog tier=ENTERPRISE) — the
--      previous seed migration miscoded BASIC's intake_forms as true.
--   2. Drops the legacy `zatcaEnabled` key from every Plan.limits row
--      (audit Q11 — superseded by the snake_case `zatca` key).
--
-- Idempotent: jsonb merge (||) is safe to re-apply, jsonb '-' is a no-op
-- when the key is absent. Re-running this migration leaves rows unchanged.

-- ── BASIC ──────────────────────────────────────────────────────────────
-- All 15 Phase-3 keys default to false on BASIC.
-- Also fix legacy intake_forms=true (catalog tier=ENTERPRISE) → false.
UPDATE "Plan"
SET limits = (limits || '{
  "zoom_integration": false,
  "walk_in_bookings": false,
  "bank_transfer_payments": false,
  "multi_branch": false,
  "departments": false,
  "client_ratings": false,
  "data_export": false,
  "sms_provider_per_tenant": false,
  "white_label_mobile": false,
  "custom_domain": false,
  "api_access": false,
  "webhooks": false,
  "priority_support": false,
  "audit_export": false,
  "multi_currency": false,
  "intake_forms": false
}'::jsonb) - 'zatcaEnabled'
WHERE slug = 'BASIC';

-- ── PRO ────────────────────────────────────────────────────────────────
-- PRO unlocks 6 of the 15 Phase-3 keys (zoom, multi-branch, departments,
-- ratings, bank-transfer, walk-in). Rest stay false until ENTERPRISE.
UPDATE "Plan"
SET limits = (limits || '{
  "zoom_integration": true,
  "walk_in_bookings": true,
  "bank_transfer_payments": true,
  "multi_branch": true,
  "departments": true,
  "client_ratings": true,
  "data_export": false,
  "sms_provider_per_tenant": false,
  "white_label_mobile": false,
  "custom_domain": false,
  "api_access": false,
  "webhooks": false,
  "priority_support": false,
  "audit_export": false,
  "multi_currency": false
}'::jsonb) - 'zatcaEnabled'
WHERE slug = 'PRO';

-- ── ENTERPRISE ─────────────────────────────────────────────────────────
-- All 15 Phase-3 keys = true EXCEPT data_export (catalog-only, no surface yet).
UPDATE "Plan"
SET limits = (limits || '{
  "zoom_integration": true,
  "walk_in_bookings": true,
  "bank_transfer_payments": true,
  "multi_branch": true,
  "departments": true,
  "client_ratings": true,
  "data_export": false,
  "sms_provider_per_tenant": true,
  "white_label_mobile": true,
  "custom_domain": true,
  "api_access": true,
  "webhooks": true,
  "priority_support": true,
  "audit_export": true,
  "multi_currency": true
}'::jsonb) - 'zatcaEnabled'
WHERE slug = 'ENTERPRISE';

-- ── Custom plans (any non-canonical slug) ──────────────────────────────
-- Only drop the legacy zatcaEnabled key. Leave the rest as set by admins.
UPDATE "Plan"
SET limits = limits - 'zatcaEnabled'
WHERE slug NOT IN ('BASIC', 'PRO', 'ENTERPRISE')
  AND limits ? 'zatcaEnabled';
