-- Additive package ownership. Existing catalog rows remain general (NULL owner).
ALTER TABLE "SessionPackage" ADD COLUMN "ownerEmployeeId" TEXT;

CREATE INDEX "SessionPackage_ownerEmployeeId_idx"
ON "SessionPackage"("ownerEmployeeId");

ALTER TABLE "SessionPackage"
ADD CONSTRAINT "SessionPackage_ownerEmployeeId_fkey"
FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
