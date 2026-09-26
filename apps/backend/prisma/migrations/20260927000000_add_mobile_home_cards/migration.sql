CREATE TYPE "MobileHomeCardDestination" AS ENUM ('CLINICS', 'SERVICES', 'SPECIALISTS', 'PACKAGES', 'PROGRAMS');

CREATE TABLE "MobileHomeCard" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "imageFileId" TEXT,
    "imageAltAr" TEXT,
    "imageAltEn" TEXT,
    "destination" "MobileHomeCardDestination",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileHomeCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MobileHomeCard_isPublished_sortOrder_id_idx"
ON "MobileHomeCard"("isPublished", "sortOrder", "id");
