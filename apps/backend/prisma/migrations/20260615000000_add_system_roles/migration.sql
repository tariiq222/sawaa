-- Add isSystem flag and systemKey to CustomRole to support DB-backed built-in role permissions.
-- isSystem = true marks roles that are owned by the system bootstrap (cannot be deleted).
-- systemKey links the CustomRole row back to the UserRole enum so permissions can be looked up by role.

-- AlterTable
ALTER TABLE "CustomRole" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "systemKey" "UserRole";

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_systemKey_key" ON "CustomRole"("systemKey");
