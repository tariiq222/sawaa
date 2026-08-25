# Sawaa Ai Provider Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure OpenRouter or OpenAI securely from Dashboard settings and make runtime readiness depend on a tested provider connection.

**Architecture:** Store one single-tenant provider configuration with write-only AES-GCM credentials. Resolve provider clients dynamically through a generic service, expose safe management/test endpoints, and present the configuration under `/settings?tab=sawaa-ai`.

**Tech Stack:** NestJS, Prisma, AES-256-GCM credential pattern, Next.js Dashboard, OpenAPI, Jest, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-sawaa-ai-customer-agent-settings-design.md`

## Global Constraints

- Support exactly `OPENROUTER` and `OPENAI` in the first release.
- Never return, log, partially mask, or store the raw API key outside encrypted persistence.
- Fixed provider base URLs; no operator-supplied arbitrary base URL.
- `WEB_CHAT_ENABLED` alone must not make the assistant ready.
- Additive migrations only. Do not commit.

---

### Task 1: Add Generic Provider Configuration Schema

**Files:**

- Modify: `apps/backend/prisma/schema/ai.prisma`
- Create: `apps/backend/prisma/migrations/20260814091000_add_ai_provider_config/migration.sql`
- Create: `apps/backend/src/modules/ai/provider-config/ai-provider-config.types.ts`
- Create: `apps/backend/src/modules/ai/provider-config/ai-provider-config.types.spec.ts`

**Interfaces:**

- Adds `AiProvider`, `AiConnectionStatus`, and singleton `AiProviderConfig` from the spec.
- Public projection: `{ provider, model, temperature, maxTokens, isEnabled, connectionStatus, lastTestedAt, lastTestOk, lastTestErrorCode, hasCredential }`.

- [ ] Write failing projection tests proving ciphertext/key fields never escape.
- [ ] Add enum/model and additive migration.
- [ ] Implement strict configuration parsing and provider-specific model validation.
- [ ] Run Prisma validate/generate and focused tests.

### Task 2: Implement Generic Credential Encryption and Provider Resolution

**Files:**

- Create: `apps/backend/src/infrastructure/ai/ai-provider-credentials.service.ts`
- Create: `apps/backend/src/infrastructure/ai/ai-provider-credentials.service.spec.ts`
- Create: `apps/backend/src/infrastructure/ai/ai-provider-client.service.ts`
- Create: `apps/backend/src/infrastructure/ai/ai-provider-client.service.spec.ts`
- Modify: `apps/backend/src/infrastructure/ai/chat.adapter.ts`
- Modify: `apps/backend/src/infrastructure/ai/chat.adapter.spec.ts`
- Modify: `apps/backend/src/infrastructure/ai/ai.module.ts`

**Interfaces:**

- `encrypt(apiKey): string`, `decrypt(ciphertext): string` using a dedicated validated encryption key and `DEFAULT_ORG_ID` AAD.
- `getReadyClient(): Promise<{ client: OpenAI; model: string; provider: AiProvider } | null>`.

- [ ] Write failing encryption tests for round-trip, wrong key/AAD rejection, no plaintext containment, and empty-key rejection.
- [ ] Write failing resolver tests for disabled, untested, connected, 401-invalidated, and provider-specific base URL paths.
- [ ] Implement the services without importing WhatsApp modules or config.
- [ ] Refactor `ChatAdapter` to resolve a ready client per operation or bounded cache version, not only at module startup.
- [ ] Ensure 401/403 updates status to `RETEST_REQUIRED` without logging provider body or key.
- [ ] Run focused infrastructure specs.

### Task 3: Add Management and Connection-Test API

**Files:**

- Create: `apps/backend/src/modules/ai/provider-config/get-ai-provider-config.handler.ts`
- Create: `apps/backend/src/modules/ai/provider-config/upsert-ai-provider-config.handler.ts`
- Create: `apps/backend/src/modules/ai/provider-config/test-ai-provider-config.handler.ts`
- Create: DTOs and focused specs in the same slice.
- Modify: `apps/backend/src/api/dashboard/ai.controller.ts`
- Modify: `apps/backend/src/modules/ai/ai.module.ts`
- Modify: `apps/backend/openapi.json` via generator only.
- Modify: `apps/dashboard/lib/types/api.generated.ts` via generator only.

**Interfaces:**

- Endpoints exactly match section 11 of the spec.
- The test endpoint accepts a candidate write-only key and provider/model, performs a bounded minimal completion, and returns safe status only.

- [ ] Write failing handler/controller tests for permissions, safe projections, candidate-key testing, persistence after successful test, failure status, and enable refusal without successful test.
- [ ] Implement handlers with RLS/transaction patterns and ActivityLog events excluding credentials.
- [ ] Add Swagger DTOs and exact response models.
- [ ] Run focused tests, then `pnpm openapi:sync` from the current worktree backend.

### Task 4: Build the Sawaa Ai Settings Tab

**Files:**

- Modify: `apps/dashboard/app/(dashboard)/settings/page.tsx`
- Create: `apps/dashboard/components/features/settings/sawaa-ai-settings-content.tsx`
- Create: focused provider integration form/components under `apps/dashboard/components/features/settings/sawaa-ai/`.
- Create: `apps/dashboard/lib/api/sawaa-ai-settings.ts`
- Create: `apps/dashboard/hooks/use-sawaa-ai-settings.ts`
- Modify Arabic/English translation fragments and parity tests.
- Create focused Vitest specs.

**Interfaces:**

- Tab key `sawaa-ai` replaces `whatsapp`.
- UI never receives existing key; blank key means preserve credential, entered key is write-only.

- [ ] Write failing UI tests for OpenRouter/OpenAI selection, model, write-only key, test connection, failed connection, save, enable gating, and read-only permission behavior.
- [ ] Implement API hooks and forms using existing settings patterns and design tokens.
- [ ] Remove the WhatsApp tab mount without deleting its code in this task.
- [ ] Add Arabic/English copy and i18n parity coverage.
- [ ] Run focused dashboard tests, typecheck, and lint.

### Task 5: Provider Readiness Gate

**Files:**

- Modify: `apps/backend/src/modules/comms/chat/web-chat-availability.service.ts`
- Modify: corresponding specs.
- Modify: assistant worker/service readiness tests.

- [ ] Add failing tests proving web chat UI flag can be on while AI processing remains unavailable until provider status is connected.
- [ ] Return a safe retry/handoff state for persisted messages when readiness is lost.
- [ ] Do not expose provider brand or error details to customers.
- [ ] Run focused backend suites, typecheck, Prisma validation, affected lint, and diff check; report without commit.
