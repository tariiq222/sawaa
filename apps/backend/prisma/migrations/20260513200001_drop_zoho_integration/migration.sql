-- Drop Zoho integration tables — feature removed from sawa single-tenant build
DROP TABLE IF EXISTS "ZohoWebhookEvent" CASCADE;
DROP TABLE IF EXISTS "IntegrationAuditLog" CASCADE;
DROP TABLE IF EXISTS "ZohoCreditNoteLink" CASCADE;
DROP TABLE IF EXISTS "ZohoInvoiceLink" CASCADE;
DROP TABLE IF EXISTS "ZohoContactLink" CASCADE;
