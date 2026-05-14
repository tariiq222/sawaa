-- Add tokenVersion to User for JWT session invalidation.
-- Incremented on logout, switch-org, and password change to invalidate outstanding JWTs.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
