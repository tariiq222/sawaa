-- SaaS-03: Verticals system — platform-level Vertical + seed + override tables,
-- plus nullable Organization.verticalId FK.

-- CreateEnum
CREATE TYPE "TemplateFamily" AS ENUM ('MEDICAL', 'CONSULTING', 'SALON', 'FITNESS');

-- CreateTable Vertical
CREATE TABLE "Vertical" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "templateFamily" "TemplateFamily" NOT NULL,
  "descriptionAr" TEXT,
  "descriptionEn" TEXT,
  "iconUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vertical_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vertical_slug_key" ON "Vertical"("slug");
CREATE INDEX "Vertical_templateFamily_idx" ON "Vertical"("templateFamily");
CREATE INDEX "Vertical_isActive_sortOrder_idx" ON "Vertical"("isActive", "sortOrder");

-- CreateTable VerticalSeedDepartment
CREATE TABLE "VerticalSeedDepartment" (
  "id" TEXT NOT NULL,
  "verticalId" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerticalSeedDepartment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerticalSeedDepartment_verticalId_nameAr_key" ON "VerticalSeedDepartment"("verticalId", "nameAr");
CREATE INDEX "VerticalSeedDepartment_verticalId_idx" ON "VerticalSeedDepartment"("verticalId");
ALTER TABLE "VerticalSeedDepartment" ADD CONSTRAINT "VerticalSeedDepartment_verticalId_fkey"
  FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable VerticalSeedServiceCategory
CREATE TABLE "VerticalSeedServiceCategory" (
  "id" TEXT NOT NULL,
  "verticalId" TEXT NOT NULL,
  "departmentId" TEXT,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerticalSeedServiceCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerticalSeedServiceCategory_verticalId_nameAr_key" ON "VerticalSeedServiceCategory"("verticalId", "nameAr");
CREATE INDEX "VerticalSeedServiceCategory_verticalId_idx" ON "VerticalSeedServiceCategory"("verticalId");
CREATE INDEX "VerticalSeedServiceCategory_departmentId_idx" ON "VerticalSeedServiceCategory"("departmentId");
ALTER TABLE "VerticalSeedServiceCategory" ADD CONSTRAINT "VerticalSeedServiceCategory_verticalId_fkey"
  FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerticalSeedServiceCategory" ADD CONSTRAINT "VerticalSeedServiceCategory_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "VerticalSeedDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable VerticalTerminologyOverride
CREATE TABLE "VerticalTerminologyOverride" (
  "id" TEXT NOT NULL,
  "verticalId" TEXT NOT NULL,
  "tokenKey" TEXT NOT NULL,
  "valueAr" TEXT NOT NULL,
  "valueEn" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerticalTerminologyOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerticalTerminologyOverride_verticalId_tokenKey_key" ON "VerticalTerminologyOverride"("verticalId", "tokenKey");
CREATE INDEX "VerticalTerminologyOverride_verticalId_idx" ON "VerticalTerminologyOverride"("verticalId");
ALTER TABLE "VerticalTerminologyOverride" ADD CONSTRAINT "VerticalTerminologyOverride_verticalId_fkey"
  FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Organization: add verticalId FK
ALTER TABLE "Organization" ADD COLUMN "verticalId" TEXT;
CREATE INDEX "Organization_verticalId_idx" ON "Organization"("verticalId");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_verticalId_fkey"
  FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;
