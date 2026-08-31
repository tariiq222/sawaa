-- Data-only normalization: leftover OPENAI chat-provider rows become OpenRouter
-- with the pinned model and must be retested before enablement.
-- No ALTER TYPE and no destructive operations.

UPDATE "AiProviderConfig"
SET
  "provider" = 'OPENROUTER',
  "model" = 'deepseek/deepseek-v4-flash-0731',
  "isEnabled" = false,
  "connectionStatus" = 'RETEST_REQUIRED',
  "lastTestOk" = false,
  "lastTestErrorCode" = 'RETEST_REQUIRED',
  "testedConfigHash" = NULL,
  "configVersion" = "configVersion" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "provider" = 'OPENAI';
