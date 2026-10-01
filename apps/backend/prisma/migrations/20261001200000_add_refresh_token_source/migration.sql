-- Additive: records which sign-in channel minted a staff refresh token.
-- Nullable with no default, so existing rows stay NULL and no table rewrite occurs.
CREATE TYPE "RefreshTokenSource" AS ENUM ('DASHBOARD', 'MOBILE');

ALTER TABLE "RefreshToken" ADD COLUMN "source" "RefreshTokenSource";
