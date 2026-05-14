-- Add emailVerified column to Client. Default false so existing rows remain
-- "unverified"; the dashboard table renders a green ✓ beside the email when true.
ALTER TABLE "Client"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
