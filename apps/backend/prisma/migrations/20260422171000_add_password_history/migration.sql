-- PasswordHistory model: prevents password reuse within N previous passwords
-- 2026-04-22

CREATE TABLE "PasswordHistory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordHistory_clientId_createdAt_idx" ON "PasswordHistory"("clientId", "createdAt");
CREATE INDEX "PasswordHistory_organizationId_idx" ON "PasswordHistory"("organizationId");

-- Add organizationId to all scoped models in this migration (for consistency)
ALTER TABLE "PasswordHistory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PasswordHistory" USING ("organizationId" = current_setting('app.current_organization_id', true));
