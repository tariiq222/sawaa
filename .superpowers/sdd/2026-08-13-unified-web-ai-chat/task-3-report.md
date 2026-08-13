# Task 3 — Unified guest/client messaging

Status: DONE

Commit: `feat(chat): add unified guest and client messaging` (this commit)

## Files

- Added `apps/backend/src/modules/comms/chat/messages/` with the send DTO, send/list handlers, safe response mapper, and focused specs.
- Updated guest/client chat controllers and their controller specs.
- Registered the two handlers in `CommsModule`.
- Added `CHAT_MAX_MESSAGE_LENGTH` validation and documented it in both environment examples.
- Limited the shared message-list query DTO to 100 records.

## TDD

- RED: the new messages/controller test set failed because the new DTO, handlers, and mapper did not exist.
- GREEN: message DTO validation, owner-bound send/list behavior, normal duplicate replay, `P2002` race read-back, transaction counter update, stable cursor ordering, safe mapping, closed-write rejection, and controller cookie/session boundaries now pass.

## Validation

- `pnpm --filter=backend test -- src/modules/comms/chat/messages src/api/public/public-chat.controller.spec.ts src/api/public/my-chat.controller.spec.ts` — 6 suites, 21 tests passed.
- `pnpm --filter=backend test -- src/modules/comms/chat/guest` — 5 suites, 17 tests passed.
- `pnpm --filter=backend typecheck` — passed.
- `git diff --check` — passed.

## Registration and handoff

- `CommsModule` provides the new handlers.
- Central controller registration in `PublicModule` remains intentionally untouched for Task 12; no OpenAPI snapshot sync was run, also owned by Task 12.
- No AI completion is invoked here. The persisted inbound message is the durable handoff for Task 4.

## Concerns

None within Task 3 scope. Task 12 must register the already-tested controllers before the endpoints are live in the application module graph.
