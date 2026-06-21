-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "programId" TEXT;

-- AlterTable
ALTER TABLE "GroupSession" DROP COLUMN "serviceId",
ADD COLUMN     "programId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "GroupProgram" (
    "id" TEXT NOT NULL,
    "ref" SERIAL NOT NULL,
    "departmentId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "minParticipants" INTEGER NOT NULL DEFAULT 1,
    "maxParticipants" INTEGER NOT NULL DEFAULT 30,
    "defaultPrice" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupProgram_ref_key" ON "GroupProgram"("ref");

-- CreateIndex
CREATE INDEX "GroupProgram_departmentId_idx" ON "GroupProgram"("departmentId");

-- CreateIndex
CREATE INDEX "GroupProgram_isActive_idx" ON "GroupProgram"("isActive");

-- CreateIndex
CREATE INDEX "GroupSession_programId_idx" ON "GroupSession"("programId");

-- AddForeignKey
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "GroupProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
