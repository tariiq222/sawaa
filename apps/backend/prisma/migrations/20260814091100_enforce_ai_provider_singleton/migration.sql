-- Enforce the single-tenant key at the database boundary.
-- This is additive and the table is newly introduced and empty at this point.
ALTER TABLE "AiProviderConfig"
  ADD CONSTRAINT "AiProviderConfig_singletonKey_check"
  CHECK ("singletonKey" = 'singleton');
