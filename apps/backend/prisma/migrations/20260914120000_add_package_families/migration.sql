CREATE TABLE "PackageFamily" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PackageFamily_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PackageFamily_isActive_isPublic_idx" ON "PackageFamily"("isActive", "isPublic");
ALTER TABLE "SessionPackage" ADD COLUMN "familyId" TEXT;
CREATE INDEX "SessionPackage_familyId_idx" ON "SessionPackage"("familyId");
ALTER TABLE "SessionPackage" ADD CONSTRAINT "SessionPackage_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "PackageFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackagePurchase" ADD COLUMN "offerSnapshot" JSONB;
