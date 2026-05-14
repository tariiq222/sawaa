-- SaaS-02f: Comms cluster tenant rollout
-- 1. Notification
ALTER TABLE "Notification" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Notification" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- 2. ChatConversation
ALTER TABLE "ChatConversation" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ChatConversation" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ChatConversation_organizationId_idx" ON "ChatConversation"("organizationId");

-- 3. CommsChatMessage
ALTER TABLE "CommsChatMessage" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "CommsChatMessage" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "CommsChatMessage_organizationId_idx" ON "CommsChatMessage"("organizationId");

-- 4. ContactMessage
ALTER TABLE "ContactMessage" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ContactMessage" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ContactMessage_organizationId_idx" ON "ContactMessage"("organizationId");

-- 5. EmailTemplate — drop global slug unique, add composite, add index
ALTER TABLE "EmailTemplate" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "EmailTemplate" ALTER COLUMN "organizationId" DROP DEFAULT;
DROP INDEX IF EXISTS "EmailTemplate_slug_key";
CREATE UNIQUE INDEX "EmailTemplate_organizationId_slug_key" ON "EmailTemplate"("organizationId", "slug");
CREATE INDEX "EmailTemplate_organizationId_idx" ON "EmailTemplate"("organizationId");

-- 6. ChatSession
ALTER TABLE "ChatSession" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ChatSession" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ChatSession_organizationId_idx" ON "ChatSession"("organizationId");

-- 7. ChatMessage
ALTER TABLE "ChatMessage" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ChatMessage" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ChatMessage_organizationId_idx" ON "ChatMessage"("organizationId");

-- 8. ChatbotConfig — singleton conversion.
-- 8a. Add new typed columns + organizationId
ALTER TABLE "ChatbotConfig" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "systemPromptAr" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "systemPromptEn" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "greetingAr" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "greetingEn" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "escalateToHumanAt" INTEGER;
ALTER TABLE "ChatbotConfig" ADD COLUMN "settings" JSONB;

-- 8b. Drop old key unique + category index + legacy columns, then clear rows.
DELETE FROM "ChatbotConfig";
DROP INDEX IF EXISTS "ChatbotConfig_key_key";
DROP INDEX IF EXISTS "ChatbotConfig_category_idx";
ALTER TABLE "ChatbotConfig" DROP COLUMN "key";
ALTER TABLE "ChatbotConfig" DROP COLUMN "value";
ALTER TABLE "ChatbotConfig" DROP COLUMN "category";

-- 8c. Seed a singleton for DEFAULT_ORG (admins re-enter via dashboard).
INSERT INTO "ChatbotConfig" ("id", "organizationId", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', NOW(), NOW());

-- 8d. Lock organizationId NOT NULL + unique
ALTER TABLE "ChatbotConfig" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE UNIQUE INDEX "ChatbotConfig_organizationId_key" ON "ChatbotConfig"("organizationId");

-- 9. Row Level Security on all 8 tables
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommsChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatbotConfig" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "Notification" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ChatConversation" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "CommsChatMessage" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ContactMessage" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "EmailTemplate" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ChatSession" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ChatMessage" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ChatbotConfig" USING ("organizationId" = current_setting('app.current_organization_id', true));
