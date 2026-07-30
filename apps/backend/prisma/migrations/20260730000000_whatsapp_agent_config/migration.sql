-- WhatsApp Agent — config singleton + conversations + messages.
-- Additive only. No existing table is modified. Singleton pattern follows
-- OrganizationEmailConfig (no @unique singletonKey; findFirst + create-if-missing).

-- CreateEnum
CREATE TYPE "WhatsappProvider" AS ENUM ('META_CLOUD', 'EVOLUTION_API');

-- CreateTable: WhatsApp agent config (single row, findFirst pattern)
CREATE TABLE "WhatsappAgentConfig" (
    "id" TEXT NOT NULL,
    "provider" "WhatsappProvider" NOT NULL DEFAULT 'EVOLUTION_API',
    -- Evolution API transport
    "evolutionBaseUrl" TEXT,
    "evolutionInstanceName" TEXT,
    -- Meta Cloud API identifiers (plain — safe to expose)
    "phoneNumberId" TEXT,
    "businessAccountId" TEXT,
    -- Encrypted blob (AES-256-GCM) — base64(iv||tag||ciphertext)
    "credentialsCiphertext" TEXT,
    "webhookSecretEnc" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    -- AI / LLM settings (plain - not secrets)
    "aiModel" TEXT NOT NULL DEFAULT 'anthropic/claude-3.5-haiku',
    "aiTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "aiMaxTokens" INTEGER NOT NULL DEFAULT 800,
    "systemPromptAr" TEXT NOT NULL DEFAULT '',
    "systemPromptEn" TEXT NOT NULL DEFAULT '',
    "greetingAr" TEXT,
    "greetingEn" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'ar',
    "businessHoursOnly" BOOLEAN NOT NULL DEFAULT false,
    "activeDays" INTEGER[] DEFAULT ARRAY[0,1,2,3,4]::INTEGER[],
    -- Runtime state (operator-visible)
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "connectedPhone" TEXT,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "messagesCount" INTEGER NOT NULL DEFAULT 0,
    "activeChatCount" INTEGER NOT NULL DEFAULT 0,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappAgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateEnum: conversation status
CREATE TYPE "WhatsappConversationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED', 'TAKEOVER', 'BLOCKED');

-- CreateEnum: message role
CREATE TYPE "WhatsappMessageRole" AS ENUM ('USER', 'ASSISTANT', 'STAFF', 'TOOL', 'SYSTEM');

-- CreateTable: WhatsApp conversations
CREATE TABLE "WhatsappConversation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "clientId" TEXT,
    "status" "WhatsappConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "language" TEXT NOT NULL DEFAULT 'ar',
    "context" JSONB,
    "staffTakeover" BOOLEAN NOT NULL DEFAULT false,
    "staffUserId" TEXT,
    "staffTookOverAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WhatsApp messages
CREATE TABLE "WhatsappMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "WhatsappMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolResults" JSONB,
    "tokenUsage" INTEGER,
    "latencyMs" INTEGER,
    "externalMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappConversation_phone_key" ON "WhatsappConversation"("phone");

-- CreateIndex
CREATE INDEX "WhatsappConversation_status_lastMessageAt_idx" ON "WhatsappConversation"("status", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappConversation_clientId_idx" ON "WhatsappConversation"("clientId");

-- CreateIndex
CREATE INDEX "WhatsappConversation_lastMessageAt_idx" ON "WhatsappConversation"("lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsappMessage_conversationId_createdAt_idx" ON "WhatsappMessage"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMessage_externalMessageId_key" ON "WhatsappMessage"("externalMessageId");

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
