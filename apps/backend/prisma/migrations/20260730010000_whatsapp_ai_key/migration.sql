-- Add aiApiKeyEncrypted column to WhatsappAgentConfig so the operator can
-- rotate the OpenRouter API key from the dashboard without restarting the
-- backend. Stored encrypted (AES-256-GCM) under the same WHATSAPP_PROVIDER_
-- ENCRYPTION_KEY used for the other provider creds.

-- AlterTable
ALTER TABLE "WhatsappAgentConfig"
  ADD COLUMN "aiApiKeyEncrypted" TEXT;
