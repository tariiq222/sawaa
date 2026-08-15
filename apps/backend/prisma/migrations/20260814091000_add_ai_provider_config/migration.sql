-- Add the single-tenant AI provider configuration. This migration is additive;
-- it does not read, copy, or delete any existing provider credentials.

CREATE TYPE "AiProvider" AS ENUM ('OPENROUTER', 'OPENAI');

CREATE TYPE "AiConnectionStatus" AS ENUM (
  'NOT_CONFIGURED',
  'CONNECTED',
  'FAILED',
  'RETEST_REQUIRED'
);

CREATE TABLE "AiProviderConfig" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "singletonKey" TEXT NOT NULL DEFAULT 'singleton',
  "provider" "AiProvider" NOT NULL,
  "credentialCiphertext" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
  "maxTokens" INTEGER NOT NULL DEFAULT 800,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "connectionStatus" "AiConnectionStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "lastTestedAt" TIMESTAMP(3),
  "lastTestOk" BOOLEAN,
  "lastTestErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderConfig_singletonKey_key"
  ON "AiProviderConfig" ("singletonKey");
