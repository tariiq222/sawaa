-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "valueText" TEXT,
    "valueAr" TEXT,
    "valueEn" TEXT,
    "valueJson" JSONB,
    "valueMedia" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "SiteSetting_updatedAt_idx" ON "SiteSetting"("updatedAt");
