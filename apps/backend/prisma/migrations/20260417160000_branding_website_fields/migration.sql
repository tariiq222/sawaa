-- CreateEnum
CREATE TYPE "WebsiteTheme" AS ENUM ('SAWAA', 'PREMIUM');

-- AlterTable
ALTER TABLE "BrandingConfig" ADD COLUMN "websiteDomain" TEXT,
ADD COLUMN "activeWebsiteTheme" "WebsiteTheme" NOT NULL DEFAULT 'SAWAA';

-- CreateIndex
CREATE UNIQUE INDEX "BrandingConfig_websiteDomain_key" ON "BrandingConfig"("websiteDomain");
