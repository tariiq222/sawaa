# Sawaa Ai Customer Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the closed administrative phrase grammar with a bounded Saudi conversational customer-service and sales agent that remains grounded in Sawaa tools.

**Architecture:** Keep deterministic input-shape and prohibited-policy blocking, but allow all benign conversation to reach the model. Require the model to finish through a structured `replyToCustomer` tool whose arguments are validated, grounded against tool executions, and persisted through the existing lease/idempotency pipeline.

**Tech Stack:** NestJS 11, TypeScript, Prisma 7, Jest, OpenAI-compatible tool calling, BullMQ.

**Spec:** `docs/superpowers/specs/2026-08-14-sawaa-ai-customer-agent-settings-design.md`

## Global Constraints

- Preserve `ChatConversation` and `CommsChatMessage` as the only conversation history.
- Never diagnose, assess, triage, provide treatment advice, or emit automated emergency guidance.
- Keep booking mutations behind authenticated deterministic confirmation endpoints.
- Do not persist chain-of-thought, raw provider payloads, prompts, secrets, or clinical inference.
- Additive Prisma migrations only; never edit an existing migration.
- Do not commit. The orchestrator owns integration and final verification.

---

### Task 1: Replace the Closed Allowlist with a Deny-Only Safety Gate

**Files:**

- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-scope-gate.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-scope-gate.spec.ts`

**Interfaces:**

- Produces: `classifyAdministrativeText(message): "CONVERSATIONAL" | "BLOCKED_POLICY"`
- Consumes: existing Unicode/input-shape limits and injection/clinical deny corpus.

- [ ] Add failing table tests proving `السلام عليكم`, `سلام عليكم`, `هلا والله`, `كيف حالك`, `شكرا`, `مع السلامة`, colloquial service discovery, price objections, and benign unrelated questions return `CONVERSATIONAL`.
- [ ] Add failing tests proving clinical advice requests, diagnosis requests, prompt injection, secret extraction, and Unicode floods return `BLOCKED_POLICY` before provider invocation.
- [ ] Run `pnpm --filter=backend test -- src/modules/comms/chat/assistant/administrative-scope-gate.spec.ts --runInBand` and record the expected failures.
- [ ] Keep `hasAcceptableTextShape` and normalization defenses, delete the administrative intent allowlist, and implement narrowly named prohibited-policy patterns with deny precedence.
- [ ] Update the service call site and types without adding a general web-topic block.
- [ ] Re-run the focused spec and require all cases to pass.

### Task 2: Add the Structured Final Reply Contract

**Files:**

- Create: `apps/backend/src/modules/comms/chat/assistant/sawaa-agent-decision.ts`
- Create: `apps/backend/src/modules/comms/chat/assistant/sawaa-agent-decision.spec.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-tools.service.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-tools.service.spec.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-output-validator.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-output-validator.spec.ts`

**Interfaces:**

- Produces:
  - `SawaaAgentDecision`
  - `SawaaJourneyStage`
  - `parseSawaaAgentDecision(value: unknown): SawaaAgentDecision | null`
  - tool name `replyToCustomer`
- `replyToCustomer` arguments: `{ reply, intent, journeyStage, factsUsed?, contextPatch?, handoffDraft? }`.

- [ ] Write failing parser tests for valid Saudi replies, maximum lengths, allowlisted intent/stage values, safe non-clinical context fields, and rejection of unknown keys, clinical fields, internal IDs, URLs, secrets, or oversized values.
- [ ] Write failing tool-definition tests proving `replyToCustomer` is the only final-response tool and has a closed JSON schema with `additionalProperties: false`.
- [ ] Write failing output-validator tests proving Saudi greetings pass while diagnosis, treatment promises, invented discounts, prompt leakage, and ungrounded prices fail.
- [ ] Implement the contract parser as an explicit projection; never spread model arguments.
- [ ] Add `replyToCustomer` to tool definitions, but keep it side-effect free and execute it only as a parsed decision.
- [ ] Implement output validation with fixed safe fallback and maximum response length.
- [ ] Run the three focused specs and require green.

### Task 3: Add Non-Clinical Customer Journey Context

**Files:**

- Modify: `apps/backend/prisma/schema/comms.prisma`
- Create: `apps/backend/prisma/migrations/20260814090000_add_sawaa_customer_context/migration.sql`
- Create: `apps/backend/src/modules/comms/chat/assistant/sawaa-customer-context.ts`
- Create: `apps/backend/src/modules/comms/chat/assistant/sawaa-customer-context.spec.ts`

**Interfaces:**

- Adds nullable `customerContext Json?` and integer `customerContextVersion Int @default(0)` to `ChatConversation`.
- Produces `mergeSawaaCustomerContext(current, patch)` with explicit fields from the spec.

- [ ] Write failing unit tests for allowed service/practitioner IDs, modality, days, time window, budget concern, selected IDs, and stage.
- [ ] Write failing tests rejecting symptoms, diagnosis, risk, free-form clinical notes, unknown keys, excessive arrays, and invalid IDs.
- [ ] Add the Prisma fields and an additive migration with no data deletion.
- [ ] Implement explicit projection and bounded merge semantics.
- [ ] Run `pnpm --filter=backend exec prisma validate` and the context spec.

### Task 4: Orchestrate Natural Multi-Turn Replies

**Files:**

- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-policy.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-policy.spec.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-assistant.service.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-assistant.service.spec.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-response-renderer.ts`
- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-response-renderer.spec.ts`

**Interfaces:**

- Consumes: `replyToCustomer`, `parseSawaaAgentDecision`, `mergeSawaaCustomerContext`.
- Produces: one validated AI `TEXT` response or an existing deterministic `ACTION_CARD`/handoff result per inbound message.

- [ ] Add failing service tests for greeting, thanks, goodbye, Saudi small talk, service discovery, price objection, benign unrelated redirection, and multi-turn context reuse.
- [ ] Add failing tests proving blocked-policy inputs never reach provider/tools and receive the fixed non-analytical boundary response.
- [ ] Add failing grounding tests: a decision containing price, service, practitioner, or availability facts must reference record IDs returned by executions in the same message.
- [ ] Add failing tests proving `replyToCustomer` cannot execute a booking, confirm, reschedule, cancellation, or arbitrary handoff.
- [ ] Replace the “administrative information assistant” prompt with the approved Saudi customer-service/sales persona and immutable boundaries.
- [ ] Update the tool-round loop to require exactly one valid `replyToCustomer` final call, ignore raw model prose, and persist only the validated reply.
- [ ] Apply `contextPatch` inside the final persistence transaction guarded by exact conversation stateVersion, lease owner, message dispatch attempt, and context version.
- [ ] Preserve existing retry, lease, token reservation, idempotency, and exact-target behavior.
- [ ] Run policy, renderer, validator, tools, lease, worker, and assistant focused specs.

### Task 5: Integrate Handoff Detail Collection

**Files:**

- Modify: `apps/backend/src/modules/comms/chat/assistant/administrative-tools.service.ts`
- Modify: `apps/backend/src/modules/comms/chat/request-handoff/request-handoff.handler.ts`
- Modify: corresponding focused specs.
- Modify: `apps/backend/src/modules/comms/chat/staff/staff-conversation.mapper.ts`
- Modify: `apps/dashboard/lib/types/conversations.ts`
- Modify: `apps/dashboard/components/features/conversations/conversation-detail.tsx`

**Interfaces:**

- Produces safe `handoffSummary` with `category`, `requestSummary`, `desiredOutcome`, `serviceId?`, `practitionerId?`, and `acceptableAlternatives?`.
- Guest identity remains the existing `{ guestName, guestPhone }` contract.

- [ ] Add failing tests for complaint, financial exception, unavailable appointment, and user-requested handoff summaries.
- [ ] Add failing tests rejecting clinical analysis, risk tags, raw provider fields, staff identity, or unknown metadata.
- [ ] Persist the summary atomically with `WAITING_FOR_STAFF` and audit event.
- [ ] Render the safe summary above the existing full transcript in dashboard detail.
- [ ] Use the exact customer confirmation: `تم استلام طلبك وتحويله لفريق الاستقبال، وبيتواصلون معك خلال أوقات عمل المركز.`
- [ ] Run focused backend and dashboard tests.

### Task 6: Runtime Regression Gate

**Files:**

- Modify tests only where production contracts changed.

- [ ] Run all assistant/chat focused Jest suites.
- [ ] Run backend Prisma validate/generate and backend typecheck.
- [ ] Run website chat and dashboard conversation focused tests and typechecks.
- [ ] Run affected ESLint and `git diff --check`.
- [ ] Report exact commands, counts, and any provider-dependent boundary to the orchestrator; do not commit.
