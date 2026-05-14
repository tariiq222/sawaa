-- Drop ZATCA Phase-2 module entirely.
--
-- The in-house Phase-2 stub never went live (ZATCA_ENABLED stayed false in
-- every environment, so no row was ever written to ZatcaSubmission). The
-- ZatcaConfig table held tenant-supplied VAT numbers + seller names but those
-- are now sourced from BrandingConfig.
--
-- Phase-1 QR encoding for platform subscription PDFs is in-process Buffer
-- encoding (zatca-qr.util.ts) and does NOT touch these tables — unaffected.

-- DropForeignKey
ALTER TABLE "ZatcaSubmission" DROP CONSTRAINT IF EXISTS "ZatcaSubmission_invoiceId_fkey";

-- DropTable
DROP TABLE IF EXISTS "ZatcaSubmission";

-- DropTable
DROP TABLE IF EXISTS "ZatcaConfig";

-- DropEnum
DROP TYPE IF EXISTS "ZatcaSubmissionStatus";
