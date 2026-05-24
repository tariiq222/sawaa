-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "pdfGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "sentToClientAt" TIMESTAMP(3);
