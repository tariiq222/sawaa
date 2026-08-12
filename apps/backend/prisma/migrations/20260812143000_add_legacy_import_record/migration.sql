-- CreateEnum
CREATE TYPE "LegacyImportDisposition" AS ENUM ('IMPORTED', 'LINKED_EXISTING', 'ARCHIVED_ONLY', 'SKIPPED');

-- CreateTable
CREATE TABLE "LegacyImportRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceSystem" TEXT NOT NULL,
    "sourceTenant" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "legacyId" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "disposition" "LegacyImportDisposition" NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "metadata" JSONB,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LegacyImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegacyImportRecord_sourceSystem_sourceTenant_entityType_legacyId_key"
ON "LegacyImportRecord"("sourceSystem", "sourceTenant", "entityType", "legacyId");

-- CreateIndex
CREATE INDEX "LegacyImportRecord_targetType_targetId_idx"
ON "LegacyImportRecord"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "LegacyImportRecord_disposition_idx"
ON "LegacyImportRecord"("disposition");
