-- Additive provenance only. Legacy templates, purchases, credits, invoices,
-- payments, refunds, and usage rows are deliberately untouched.
CREATE TABLE "PackageTemplateConversion" (
  "id" TEXT NOT NULL,
  "sourcePackageId" TEXT NOT NULL,
  "sourceRevision" TEXT NOT NULL,
  "draftPackageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackageTemplateConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackageTemplateConversion_draftPackageId_key"
  ON "PackageTemplateConversion"("draftPackageId");
CREATE UNIQUE INDEX "PackageTemplateConversion_sourcePackageId_sourceRevision_key"
  ON "PackageTemplateConversion"("sourcePackageId", "sourceRevision");
