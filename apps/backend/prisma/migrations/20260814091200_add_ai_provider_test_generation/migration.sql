ALTER TABLE "AiProviderConfig"
  ADD COLUMN "configVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "testedConfigHash" TEXT;
