-- SaaS-02g: AI + media + ops + platform cluster tenant rollout
-- pgvector-safe (manual SQL; migrate deploy path)

-- 1. KnowledgeDocument
ALTER TABLE "KnowledgeDocument" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "KnowledgeDocument_organizationId_idx" ON "KnowledgeDocument"("organizationId");

-- 2. DocumentChunk
ALTER TABLE "DocumentChunk" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "DocumentChunk" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "DocumentChunk_organizationId_idx" ON "DocumentChunk"("organizationId");

-- 3. File — add orgId, swap global storageKey unique for composite (was a UNIQUE INDEX)
ALTER TABLE "File" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "File" ALTER COLUMN "organizationId" DROP DEFAULT;
DROP INDEX IF EXISTS "File_storageKey_key";
CREATE UNIQUE INDEX "File_organizationId_storageKey_key" ON "File"("organizationId", "storageKey");
CREATE INDEX "File_organizationId_idx" ON "File"("organizationId");

-- 4. ActivityLog
ALTER TABLE "ActivityLog" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ActivityLog" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ActivityLog_organizationId_idx" ON "ActivityLog"("organizationId");

-- 5. Report
ALTER TABLE "Report" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Report" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "Report_organizationId_idx" ON "Report"("organizationId");

-- 6. ProblemReport
ALTER TABLE "ProblemReport" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ProblemReport" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ProblemReport_organizationId_idx" ON "ProblemReport"("organizationId");

-- 7. Integration — swap global provider unique to composite
ALTER TABLE "Integration" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Integration" ALTER COLUMN "organizationId" DROP DEFAULT;
-- Initial migration created `Integration_provider_key` as a UNIQUE INDEX (not constraint).
DROP INDEX IF EXISTS "Integration_provider_key";
CREATE UNIQUE INDEX "Integration_organizationId_provider_key" ON "Integration"("organizationId", "provider");
CREATE INDEX "Integration_organizationId_idx" ON "Integration"("organizationId");

-- 8. FeatureFlag — same swap (unique was a UNIQUE INDEX, not constraint)
ALTER TABLE "FeatureFlag" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "FeatureFlag" ALTER COLUMN "organizationId" DROP DEFAULT;
DROP INDEX IF EXISTS "FeatureFlag_key_key";
CREATE UNIQUE INDEX "FeatureFlag_organizationId_key_key" ON "FeatureFlag"("organizationId", "key");
CREATE INDEX "FeatureFlag_organizationId_idx" ON "FeatureFlag"("organizationId");

-- 9. SiteSetting — key-value scoped per org (composite PK (organizationId, key))
--    Pattern matches EmailTemplate/Integration/FeatureFlag. NOT a singleton — one row per (org, setting key).
ALTER TABLE "SiteSetting" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "SiteSetting" ALTER COLUMN "organizationId" DROP DEFAULT;
-- Swap single-column `key` PK for composite PK, and drop the legacy `id` column.
ALTER TABLE "SiteSetting" DROP CONSTRAINT "SiteSetting_pkey";
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "id";
ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("organizationId", "key");
CREATE INDEX "SiteSetting_organizationId_idx" ON "SiteSetting"("organizationId");

-- 10. RLS on all 8 + SiteSetting
ALTER TABLE "KnowledgeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentChunk"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProblemReport"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeatureFlag"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSetting"       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "KnowledgeDocument" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "DocumentChunk"     USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "File"              USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ActivityLog"       USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Report"            USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ProblemReport"     USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Integration"       USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "FeatureFlag"       USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "SiteSetting"       USING ("organizationId" = current_setting('app.current_organization_id', true));
