-- Add tokenVersion to Client model for JWT token versioning
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Add unique constraint on File.storageKey
ALTER TABLE "File" ADD CONSTRAINT "File_storageKey_key" UNIQUE ("storageKey");

-- Add unique constraint on Coupon.code
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_code_key" UNIQUE ("code");
