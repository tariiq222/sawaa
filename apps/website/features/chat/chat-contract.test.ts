import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ChatConversationDetail, ChatMessagePage, ChatMessage } from './chat.types';

/**
 * Drift guard for the website's guest-chat wire types (MNT-08).
 *
 * The website consumes `@sawaa/api-client` types (hand-written) and has no
 * generated-types artifact of its own, so this test reads the committed
 * OpenAPI snapshot and fails when the documented guest-chat schemas stop
 * matching the shapes the widget reads. It compares KEY SETS only and never
 * touches a request URL or body.
 *
 * Endpoints covered (unauthenticated guest surface):
 *   POST /public/chat/conversations
 *   GET  /public/chat/conversations/current
 *   GET  /public/chat/conversations/{conversationId}/messages
 */

type Schemas = Record<string, { required?: string[]; properties?: Record<string, unknown> }>;

const spec = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../apps/backend/openapi.json'), 'utf8'),
) as { components: { schemas: Schemas } };

const schema = (name: string) => {
  const found = spec.components.schemas[name];
  if (!found) throw new Error(`Missing OpenAPI schema ${name}`);
  return found;
};

type KeysOf<T> = Extract<keyof T, string>;

function expectSameKeys(documented: string[], local: readonly string[]) {
  expect([...documented].sort()).toEqual([...local].sort());
}

describe('guest chat types mirror the OpenAPI snapshot', () => {
  it('ChatConversationDetail covers the documented conversation keys', () => {
    // The local type splits into summary + detail; the wire shape is flat.
    const local: KeysOf<ChatConversationDetail>[] = [
      'id', 'status', 'language', 'createdAt', 'updatedAt', 'employeeId', 'isAiChat',
    ];
    const documented = Object.keys(schema('PublicGuestChatConversationDto').properties ?? {});
    // Every key the widget reads is documented and required.
    for (const key of local) {
      expect(documented, `conversation key "${key}" is not documented`).toContain(key);
      expect(schema('PublicGuestChatConversationDto').required ?? []).toContain(key);
    }
    // The one documented key the hand-written api-client type omits. Retyping
    // `ChatConversationDetail` from the snapshot is MNT-09 (api-client unit),
    // not this documentation-only unit; the widget never reads `clientId`.
    expect(documented.filter((key) => !local.includes(key as KeysOf<ChatConversationDetail>))).toEqual(['clientId']);
  });

  it('ChatMessage base keys are all documented and metadata stays optional', () => {
    const documented = Object.keys(schema('PublicGuestChatMessageDto').properties ?? {});
    const required = schema('PublicGuestChatMessageDto').required ?? [];
    // Every key the widget reads on any message kind must be documented.
    // (`metadata` is not in `keyof ChatMessage` because ChatSystemEventMessage
    // has no such property; it is asserted separately below.)
    const read: ReadonlyArray<keyof ChatMessage | 'metadata'> = [
      'id', 'conversationId', 'senderType', 'body', 'kind', 'clientMessageId', 'createdAt', 'metadata',
    ];
    for (const key of read) {
      expect(documented, `message key "${key}" is not documented`).toContain(key);
    }
    // `metadata` is documented (some kinds carry it) and must stay optional.
    expect(required).not.toContain('metadata');
  });

  it('ChatMessagePage mirrors the documented data/meta envelope', () => {
    const page = schema('PublicGuestChatMessagePageDto');
    expectSameKeys(page.required ?? [], ['data', 'meta']);
    const meta = schema('PublicGuestChatMessageCursorMetaDto');
    const local: KeysOf<ChatMessagePage['meta']>[] = ['limit', 'nextCursor', 'hasMore'];
    expectSameKeys(meta.required ?? [], local);
  });
});
