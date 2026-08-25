# Sawaa Ai Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the existing Sawaa knowledge base so operators can author, publish, index, and safely use grounded content from Dashboard settings.

**Architecture:** Extend the existing `KnowledgeDocument`/`DocumentChunk` models instead of creating a second store. Publication and indexing are explicit states; only published, successfully indexed documents are searchable by the customer agent.

**Tech Stack:** NestJS, Prisma pgvector, BullMQ, Next.js Dashboard, Jest, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-sawaa-ai-customer-agent-settings-design.md`

## Global Constraints

- Reuse `KnowledgeDocument`, `DocumentChunk`, and `SemanticSearchHandler`.
- No raw embeddings in API responses.
- Treat all knowledge content as untrusted data, never instructions.
- Only published and successfully indexed documents reach RAG.
- Additive migrations only. Do not commit.

---

### Task 1: Add Authoring and Publication State

**Files:**

- Modify: `apps/backend/prisma/schema/ai.prisma`
- Create: `apps/backend/prisma/migrations/20260814092000_complete_ai_knowledge_base/migration.sql`
- Modify: `apps/backend/src/modules/ai/manage-knowledge-base/manage-knowledge-base.dto.ts`
- Modify focused specs.

**Interfaces:**

- Add document `content String?`, `isPublished Boolean @default(false)`, `publishedAt DateTime?`, `lastIndexedAt DateTime?`, `lastIndexErrorCode String?`, and `contentHash String?`.

- [ ] Write failing schema/DTO tests for manual content, safe URL source, draft/publish fields, content limits, and rejection of raw HTML/script or unsupported source types.
- [ ] Add fields and additive migration; existing documents remain unpublished until explicitly reviewed.
- [ ] Run Prisma validate/generate and focused DTO tests.

### Task 2: Complete Knowledge CRUD and Publish Handlers

**Files:**

- Modify: `apps/backend/src/modules/ai/manage-knowledge-base/manage-knowledge-base.handler.ts`
- Modify/add focused specs.
- Create explicit create, publish, unpublish, and reindex command DTOs if the existing file limit requires it.

**Interfaces:**

- Produces create/update/publish/unpublish/reindex methods with safe projections.
- Reindex writes a stable outbox event keyed by document ID and content hash.

- [ ] Add failing tests for create manual, update draft, publish only after content exists, unpublish, delete, cursor/page isolation, stable reindex idempotency, and safe response projection.
- [ ] Add failing tests proving published content changes immediately unpublish until new indexing completes.
- [ ] Implement transactional status transitions and ActivityLog events without document body.
- [ ] Run focused handler tests.

### Task 3: Add Durable Indexing Worker and Search Filter

**Files:**

- Create worker/event files under `apps/backend/src/modules/ai/knowledge-indexing/`.
- Modify: `apps/backend/src/modules/ai/semantic-search/semantic-search.handler.ts`
- Modify: `apps/backend/src/modules/ai/ai.module.ts`
- Add focused worker/search specs.

**Interfaces:**

- Event name `ai.knowledge.reindex_requested.v1` with `{ documentId, contentHash }`.
- Search query joins documents where `isPublished=true`, `status=EMBEDDED`, and hash matches indexed content.

- [ ] Write failing tests for exact event idempotency, stale event supersession, embedding failure, retry, and publication filter.
- [ ] Implement chunk replacement transactionally after embeddings succeed; never leave mixed old/new chunks searchable.
- [ ] Store only safe error codes, not provider bodies.
- [ ] Run focused worker/search tests.

### Task 4: Complete Dashboard Knowledge UI and API

**Files:**

- Modify: `apps/backend/src/api/dashboard/ai.controller.ts`
- Modify OpenAPI/generated types through sync.
- Modify: `apps/dashboard/components/features/chatbot/knowledge-base-tab.tsx`
- Modify: `apps/dashboard/components/features/chatbot/kb-entry-columns.tsx`
- Create author/edit/detail components and focused tests.
- Modify Dashboard API/hooks/types and translations.

- [ ] Write failing backend controller and UI tests for create, edit, publish, unpublish, reindex, delete confirmation, loading/error/empty, permissions, and pagination.
- [ ] Implement exact endpoints from the spec with Swagger models.
- [ ] Mount knowledge base inside the `sawaa-ai` settings content, not a WhatsApp/chatbot legacy page.
- [ ] Display publication and indexing states separately and never display embeddings.
- [ ] Run OpenAPI sync, focused backend/dashboard tests, typechecks, i18n parity, lint, and diff check; report without commit.
