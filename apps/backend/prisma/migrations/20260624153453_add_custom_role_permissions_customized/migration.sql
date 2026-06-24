-- Add permissionsCustomized flag to CustomRole.
-- For system roles (isSystem = true): once an admin edits their permissions via
-- the dashboard, this flips to true so SystemRolesBootstrap stops overwriting
-- them from BUILT_IN on every boot. Never-customized system roles and fresh
-- installs keep receiving BUILT_IN updates on boot. Always false for custom roles.

-- AlterTable
ALTER TABLE "CustomRole" ADD COLUMN     "permissionsCustomized" BOOLEAN NOT NULL DEFAULT false;
