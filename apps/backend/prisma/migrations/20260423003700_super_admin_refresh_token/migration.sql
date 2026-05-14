-- Make RefreshToken.organizationId optional to support super-admin tokens
ALTER TABLE "RefreshToken" ALTER COLUMN "organizationId" DROP NOT NULL;
