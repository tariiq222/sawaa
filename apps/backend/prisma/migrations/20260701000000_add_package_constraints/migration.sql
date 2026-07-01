-- Flexible package eligibility: replace the rigid (service, employee, duration) triple on
-- package items / credits with multi-dimensional constraints (ANY | INCLUDE | EXCLUDE).
-- Additive + backfill only. Legacy scalar columns are made nullable (kept for old rows);
-- new eligibility lives in the constraint tables. No data is dropped.

-- CreateEnum
CREATE TYPE "PackageConstraintDimension" AS ENUM ('SERVICE', 'PRACTITIONER', 'DURATION', 'DELIVERY_TYPE');

-- CreateEnum
CREATE TYPE "PackageConstraintMode" AS ENUM ('ANY', 'INCLUDE', 'EXCLUDE');

-- AlterTable
ALTER TABLE "PackageCredit" ALTER COLUMN "serviceId" DROP NOT NULL,
ALTER COLUMN "employeeId" DROP NOT NULL,
ALTER COLUMN "durationOptionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SessionPackageItem" ADD COLUMN     "label" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(12,2),
ALTER COLUMN "serviceId" DROP NOT NULL,
ALTER COLUMN "employeeId" DROP NOT NULL,
ALTER COLUMN "durationOptionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PackageCreditConstraint" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "dimension" "PackageConstraintDimension" NOT NULL,
    "mode" "PackageConstraintMode" NOT NULL,

    CONSTRAINT "PackageCreditConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageCreditConstraintTarget" (
    "id" TEXT NOT NULL,
    "constraintId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "PackageCreditConstraintTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPackageItemConstraint" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "dimension" "PackageConstraintDimension" NOT NULL,
    "mode" "PackageConstraintMode" NOT NULL,

    CONSTRAINT "SessionPackageItemConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPackageItemConstraintTarget" (
    "id" TEXT NOT NULL,
    "constraintId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "SessionPackageItemConstraintTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageCreditConstraint_creditId_idx" ON "PackageCreditConstraint"("creditId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageCreditConstraint_creditId_dimension_key" ON "PackageCreditConstraint"("creditId", "dimension");

-- CreateIndex
CREATE INDEX "PackageCreditConstraintTarget_constraintId_idx" ON "PackageCreditConstraintTarget"("constraintId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageCreditConstraintTarget_constraintId_targetId_key" ON "PackageCreditConstraintTarget"("constraintId", "targetId");

-- CreateIndex
CREATE INDEX "SessionPackageItemConstraint_itemId_idx" ON "SessionPackageItemConstraint"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPackageItemConstraint_itemId_dimension_key" ON "SessionPackageItemConstraint"("itemId", "dimension");

-- CreateIndex
CREATE INDEX "SessionPackageItemConstraintTarget_constraintId_idx" ON "SessionPackageItemConstraintTarget"("constraintId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPackageItemConstraintTarget_constraintId_targetId_key" ON "SessionPackageItemConstraintTarget"("constraintId", "targetId");

-- AddForeignKey
ALTER TABLE "PackageCreditConstraint" ADD CONSTRAINT "PackageCreditConstraint_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "PackageCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageCreditConstraintTarget" ADD CONSTRAINT "PackageCreditConstraintTarget_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "PackageCreditConstraint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPackageItemConstraint" ADD CONSTRAINT "SessionPackageItemConstraint_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SessionPackageItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPackageItemConstraintTarget" ADD CONSTRAINT "SessionPackageItemConstraintTarget_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "SessionPackageItemConstraint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Non-negative fixed unit price (mirrors the existing hand-added CHECK convention; Prisma
-- does not model CHECK constraints so this does not affect drift).
ALTER TABLE "SessionPackageItem"
  ADD CONSTRAINT "SessionPackageItem_unitPrice_nonneg" CHECK ("unitPrice" IS NULL OR "unitPrice" >= 0);

-- ─── Backfill: legacy single-specific triple → INCLUDE constraints ────────────────────
-- Every existing SessionPackageItem becomes SERVICE/PRACTITIONER/DURATION = INCLUDE[value].
-- gen_random_uuid() is a Postgres core function (>= 13); the target DB is Postgres 16.

-- SessionPackageItem: SERVICE
WITH new_c AS (
  INSERT INTO "SessionPackageItemConstraint" ("id", "itemId", "dimension", "mode")
  SELECT gen_random_uuid(), i."id", 'SERVICE', 'INCLUDE'
  FROM "SessionPackageItem" i
  WHERE i."serviceId" IS NOT NULL
  RETURNING "id", "itemId"
)
INSERT INTO "SessionPackageItemConstraintTarget" ("id", "constraintId", "targetId")
SELECT gen_random_uuid(), nc."id", i."serviceId"
FROM new_c nc JOIN "SessionPackageItem" i ON i."id" = nc."itemId";

-- SessionPackageItem: PRACTITIONER
WITH new_c AS (
  INSERT INTO "SessionPackageItemConstraint" ("id", "itemId", "dimension", "mode")
  SELECT gen_random_uuid(), i."id", 'PRACTITIONER', 'INCLUDE'
  FROM "SessionPackageItem" i
  WHERE i."employeeId" IS NOT NULL
  RETURNING "id", "itemId"
)
INSERT INTO "SessionPackageItemConstraintTarget" ("id", "constraintId", "targetId")
SELECT gen_random_uuid(), nc."id", i."employeeId"
FROM new_c nc JOIN "SessionPackageItem" i ON i."id" = nc."itemId";

-- SessionPackageItem: DURATION
WITH new_c AS (
  INSERT INTO "SessionPackageItemConstraint" ("id", "itemId", "dimension", "mode")
  SELECT gen_random_uuid(), i."id", 'DURATION', 'INCLUDE'
  FROM "SessionPackageItem" i
  WHERE i."durationOptionId" IS NOT NULL
  RETURNING "id", "itemId"
)
INSERT INTO "SessionPackageItemConstraintTarget" ("id", "constraintId", "targetId")
SELECT gen_random_uuid(), nc."id", i."durationOptionId"
FROM new_c nc JOIN "SessionPackageItem" i ON i."id" = nc."itemId";

-- PackageCredit: SERVICE
WITH new_c AS (
  INSERT INTO "PackageCreditConstraint" ("id", "creditId", "dimension", "mode")
  SELECT gen_random_uuid(), c."id", 'SERVICE', 'INCLUDE'
  FROM "PackageCredit" c
  WHERE c."serviceId" IS NOT NULL
  RETURNING "id", "creditId"
)
INSERT INTO "PackageCreditConstraintTarget" ("id", "constraintId", "targetId")
SELECT gen_random_uuid(), nc."id", c."serviceId"
FROM new_c nc JOIN "PackageCredit" c ON c."id" = nc."creditId";

-- PackageCredit: PRACTITIONER
WITH new_c AS (
  INSERT INTO "PackageCreditConstraint" ("id", "creditId", "dimension", "mode")
  SELECT gen_random_uuid(), c."id", 'PRACTITIONER', 'INCLUDE'
  FROM "PackageCredit" c
  WHERE c."employeeId" IS NOT NULL
  RETURNING "id", "creditId"
)
INSERT INTO "PackageCreditConstraintTarget" ("id", "constraintId", "targetId")
SELECT gen_random_uuid(), nc."id", c."employeeId"
FROM new_c nc JOIN "PackageCredit" c ON c."id" = nc."creditId";

-- PackageCredit: DURATION
WITH new_c AS (
  INSERT INTO "PackageCreditConstraint" ("id", "creditId", "dimension", "mode")
  SELECT gen_random_uuid(), c."id", 'DURATION', 'INCLUDE'
  FROM "PackageCredit" c
  WHERE c."durationOptionId" IS NOT NULL
  RETURNING "id", "creditId"
)
INSERT INTO "PackageCreditConstraintTarget" ("id", "constraintId", "targetId")
SELECT gen_random_uuid(), nc."id", c."durationOptionId"
FROM new_c nc JOIN "PackageCredit" c ON c."id" = nc."creditId";
