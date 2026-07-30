ALTER TABLE "WhatsappAgentConfig"
ALTER COLUMN "aiModel" SET DEFAULT 'qwen/qwen3.5-plus-02-15';

UPDATE "WhatsappAgentConfig"
SET "aiModel" = 'qwen/qwen3.5-plus-02-15'
WHERE "aiModel" = 'anthropic/claude-3.5-haiku';
