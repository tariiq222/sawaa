-- Additive category classification; existing rows retain the CLINIC default.
CREATE TYPE "CategoryKind" AS ENUM ('CLINIC', 'SERVICE_GROUP');
ALTER TABLE "ServiceCategory" ADD COLUMN "kind" "CategoryKind" NOT NULL DEFAULT 'CLINIC';
