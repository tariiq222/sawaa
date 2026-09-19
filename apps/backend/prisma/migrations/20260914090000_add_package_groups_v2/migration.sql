-- Additive storage for grouped V2 package definitions and immutable purchases.
-- Legacy package rows remain LEGACY and retain all existing values; no data is
-- backfilled or rewritten by this migration.

CREATE TYPE "PackageModelVersion" AS ENUM ('LEGACY', 'GROUPED_V2');
CREATE TYPE "GroupSequenceMode" AS ENUM ('ORDERED', 'UNORDERED');

ALTER TABLE "SessionPackage"
  ADD COLUMN "modelVersion" "PackageModelVersion" NOT NULL DEFAULT 'LEGACY';

CREATE TABLE "SessionPackageGroup" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT,
  "serviceId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sequenceMode" "GroupSequenceMode" NOT NULL DEFAULT 'ORDERED',
  "dependsOnGroupId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionPackageGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SessionPackageItem"
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "sessionPosition" INTEGER;

CREATE TABLE "PackagePurchaseGroup" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT,
  "serviceId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sequenceMode" "GroupSequenceMode" NOT NULL DEFAULT 'ORDERED',
  "dependsOnGroupId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackagePurchaseGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PackagePurchase"
  ADD COLUMN "modelVersion" "PackageModelVersion" NOT NULL DEFAULT 'LEGACY';

ALTER TABLE "PackageCredit"
  ADD COLUMN "purchaseGroupId" TEXT,
  ADD COLUMN "sessionPosition" INTEGER,
  ADD COLUMN "durationMinsSnapshot" INTEGER,
  ADD COLUMN "deliveryTypeSnapshot" "DeliveryType",
  ADD COLUMN "serviceNameSnapshot" TEXT,
  ADD COLUMN "employeeNameSnapshot" TEXT,
  ADD COLUMN "listPriceSnapshot" DECIMAL(12,2);

ALTER TABLE "PackageCreditUsage"
  ADD COLUMN "consumedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE TABLE "PackageCreditAssignmentEvent" (
  "id" TEXT NOT NULL,
  "creditId" TEXT NOT NULL,
  "fromEmployeeId" TEXT,
  "toEmployeeId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackageCreditAssignmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionPackageGroup_packageId_key_key"
  ON "SessionPackageGroup"("packageId", "key");
CREATE INDEX "SessionPackageGroup_packageId_idx"
  ON "SessionPackageGroup"("packageId");
CREATE INDEX "SessionPackageGroup_dependsOnGroupId_idx"
  ON "SessionPackageGroup"("dependsOnGroupId");
CREATE INDEX "SessionPackageItem_groupId_idx"
  ON "SessionPackageItem"("groupId");
CREATE UNIQUE INDEX "SessionPackageItem_groupId_sessionPosition_key"
  ON "SessionPackageItem"("groupId", "sessionPosition");

CREATE UNIQUE INDEX "PackagePurchaseGroup_purchaseId_key_key"
  ON "PackagePurchaseGroup"("purchaseId", "key");
CREATE INDEX "PackagePurchaseGroup_purchaseId_idx"
  ON "PackagePurchaseGroup"("purchaseId");
CREATE INDEX "PackagePurchaseGroup_dependsOnGroupId_idx"
  ON "PackagePurchaseGroup"("dependsOnGroupId");
CREATE INDEX "PackageCredit_purchaseGroupId_idx"
  ON "PackageCredit"("purchaseGroupId");
CREATE UNIQUE INDEX "PackageCredit_purchaseGroupId_sessionPosition_key"
  ON "PackageCredit"("purchaseGroupId", "sessionPosition");
CREATE INDEX "PackageCreditAssignmentEvent_creditId_idx"
  ON "PackageCreditAssignmentEvent"("creditId");
CREATE INDEX "PackageCreditAssignmentEvent_toEmployeeId_idx"
  ON "PackageCreditAssignmentEvent"("toEmployeeId");

ALTER TABLE "SessionPackageGroup"
  ADD CONSTRAINT "SessionPackageGroup_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "SessionPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SessionPackageGroup_dependsOnGroupId_fkey"
  FOREIGN KEY ("dependsOnGroupId") REFERENCES "SessionPackageGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SessionPackageItem"
  ADD CONSTRAINT "SessionPackageItem_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "SessionPackageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackagePurchaseGroup"
  ADD CONSTRAINT "PackagePurchaseGroup_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "PackagePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PackagePurchaseGroup_dependsOnGroupId_fkey"
  FOREIGN KEY ("dependsOnGroupId") REFERENCES "PackagePurchaseGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageCredit"
  ADD CONSTRAINT "PackageCredit_purchaseGroupId_fkey"
  FOREIGN KEY ("purchaseGroupId") REFERENCES "PackagePurchaseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageCreditAssignmentEvent"
  ADD CONSTRAINT "PackageCreditAssignmentEvent_creditId_fkey"
  FOREIGN KEY ("creditId") REFERENCES "PackageCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionPackageGroup"
  ADD CONSTRAINT "SessionPackageGroup_dependsOnGroupId_not_self_chk"
  CHECK ("dependsOnGroupId" IS NULL OR "dependsOnGroupId" <> "id");
ALTER TABLE "PackagePurchaseGroup"
  ADD CONSTRAINT "PackagePurchaseGroup_dependsOnGroupId_not_self_chk"
  CHECK ("dependsOnGroupId" IS NULL OR "dependsOnGroupId" <> "id");
ALTER TABLE "SessionPackageItem"
  ADD CONSTRAINT "SessionPackageItem_grouped_v2_shape_chk"
  CHECK ("groupId" IS NULL OR ("sessionPosition" IS NOT NULL AND "paidQuantity" = 1 AND "freeQuantity" = 0)),
  ADD CONSTRAINT "SessionPackageItem_sessionPosition_nonnegative_chk"
  CHECK ("sessionPosition" IS NULL OR "sessionPosition" >= 0);
ALTER TABLE "PackageCredit"
  ADD CONSTRAINT "PackageCredit_sessionPosition_nonnegative_chk"
  CHECK ("sessionPosition" IS NULL OR "sessionPosition" >= 0),
  ADD CONSTRAINT "PackageCredit_durationMinsSnapshot_positive_chk"
  CHECK ("durationMinsSnapshot" IS NULL OR "durationMinsSnapshot" > 0),
  ADD CONSTRAINT "PackageCredit_listPriceSnapshot_nonnegative_chk"
  CHECK ("listPriceSnapshot" IS NULL OR "listPriceSnapshot" >= 0);
