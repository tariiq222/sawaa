import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { initClient } from '../../client'
import type {
  ChatConversationDetail,
  ChatMessage,
  ChatOperation,
} from '../../types/chat'
import {
  acknowledgeChatOperation,
  claimGuestChatConversation,
  confirmChatOperation,
  createGuestChatConversation,
  declineChatOperation,
  getCurrentClientChatConversation,
  getCurrentGuestChatConversation,
  listClientChatMessages,
  listGuestChatMessages,
  requestClientChatHandoff,
  requestGuestChatHandoff,
  sendClientChatMessage,
  sendGuestChatMessage,
} from '../chat'

const conversation = {
  id: 'conversation-1',
  clientId: 'must-not-leak',
  employeeId: null,
  isAiChat: true,
  status: 'AI_ACTIVE',
  language: 'ar',
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
  guestTokenHash: 'must-not-leak',
  prompt: 'must-not-leak',
}

const operation = {
  id: 'operation-1',
  type: 'CREATE_BOOKING',
  status: 'AWAITING_CONFIRMATION',
  version: 2,
  requiredConfirmations: 1,
  confirmationCount: 0,
  expiresAt: '2026-08-13T08:15:00.000Z',
  bookingId: null,
  errorCode: null,
  summary: {
    action: 'CREATE_BOOKING',
    serviceName: 'استشارة أسرية',
    scheduledAt: '2026-08-14T08:00:00.000Z',
    clientId: 'must-not-leak',
  },
  payload: { prompt: 'must-not-leak' },
}

const message = {
  id: 'message-1',
  conversationId: 'conversation-1',
  senderType: 'AI',
  senderId: 'must-not-leak',
  body: 'راجع الموعد ثم أكده من الزر.',
  kind: 'ACTION_CARD',
  clientMessageId: null,
  createdAt: '2026-08-13T08:01:00.000Z',
  metadata: {
    action: 'CHAT_OPERATION',
    operation,
    prompt: 'must-not-leak',
  },
  model: 'must-not-leak',
}

function wrapped(data: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'a'.repeat(64),
      ...headers,
    },
  })
}

beforeEach(() => {
  initClient({
    baseUrl: 'http://api.test/api/v1',
    getAccessToken: () => null,
    onTokenRefreshed: vi.fn(),
    onAuthFailure: vi.fn(),
  })
  vi.stubGlobal('document', { cookie: 'locale=ar' })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('safe public chat contracts', () => {
  it('does not expose identity or internal fields in public response types', () => {
    expectTypeOf<ChatConversationDetail>().not.toHaveProperty('clientId')
    expectTypeOf<ChatMessage>().not.toHaveProperty('senderId')
    expectTypeOf<ChatOperation>().not.toHaveProperty('payload')
    expectTypeOf<ChatOperation>().not.toHaveProperty('prompt')
  })

  it('projects only the public conversation and action-card fields', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(wrapped({}))
      .mockResolvedValueOnce(wrapped(conversation))
      .mockResolvedValueOnce(wrapped({
        data: [message],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      }))

    const created = await createGuestChatConversation({ language: 'ar' })
    const messages = await listGuestChatMessages('conversation-1')

    expect(created).toEqual({
      id: 'conversation-1',
      employeeId: null,
      isAiChat: true,
      status: 'AI_ACTIVE',
      language: 'ar',
      createdAt: '2026-08-13T08:00:00.000Z',
      updatedAt: '2026-08-13T08:00:00.000Z',
    })
    expect(messages.data).toEqual([{
      id: 'message-1',
      conversationId: 'conversation-1',
      senderType: 'AI',
      body: 'راجع الموعد ثم أكده من الزر.',
      kind: 'ACTION_CARD',
      clientMessageId: null,
      createdAt: '2026-08-13T08:01:00.000Z',
      metadata: {
        action: 'CHAT_OPERATION',
        operation: {
          id: 'operation-1',
          type: 'CREATE_BOOKING',
          status: 'AWAITING_CONFIRMATION',
          version: 2,
          requiredConfirmations: 1,
          confirmationCount: 0,
          expiresAt: '2026-08-13T08:15:00.000Z',
          bookingId: null,
          errorCode: null,
          summary: {
            action: 'CREATE_BOOKING',
            serviceName: 'استشارة أسرية',
            scheduledAt: '2026-08-14T08:00:00.000Z',
          },
        },
      },
    }])
    expect(JSON.stringify({ created, messages })).not.toMatch(
      /must-not-leak|guestTokenHash|senderId|clientId|prompt|payload|model/,
    )
  })
})

describe('chat routes and browser credentials', () => {
  it('bootstraps CSRF from an exposed API response header when the website cannot read the API cookie', async () => {
    const token = 'b'.repeat(64)
    vi.mocked(fetch)
      .mockResolvedValueOnce(wrapped({}, { 'X-CSRF-Token': token }))
      .mockResolvedValueOnce(wrapped(conversation, { 'X-CSRF-Token': token }))

    await createGuestChatConversation({ language: 'ar' })

    expect(vi.mocked(fetch).mock.calls).toHaveLength(2)
    const [bootstrapUrl, bootstrapInit] = vi.mocked(fetch).mock.calls[0]!
    expect(bootstrapUrl).toBe('http://api.test/api/v1/public/chat/conversations/current')
    expect(bootstrapInit).toMatchObject({ method: 'GET', credentials: 'include' })

    const [mutationUrl, mutationInit] = vi.mocked(fetch).mock.calls[1]!
    expect(mutationUrl).toBe('http://api.test/api/v1/public/chat/conversations')
    expect(mutationInit).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(new Headers(mutationInit?.headers).get('x-csrf-token')).toBe(token)
    expect(document.cookie).not.toContain('ck_csrf')
  })

  it('uses the real guest and authenticated conversation/message routes', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const path = String(url)
      if (path.includes('/messages')) {
        return wrapped(path.includes('?')
          ? { data: [], meta: { limit: 5, nextCursor: null, hasMore: false } }
          : message)
      }
      if (path.endsWith('/claim')) return wrapped({ ...conversation, resumedOperations: [] })
      return wrapped(conversation)
    })

    await createGuestChatConversation({ guestName: 'سارة', language: 'ar' })
    await getCurrentGuestChatConversation()
    await getCurrentClientChatConversation()
    await claimGuestChatConversation('conversation/1')
    await sendGuestChatMessage('conversation/1', { body: 'مرحبا', clientMessageId: 'message-1' })
    await sendClientChatMessage('conversation/1', { body: 'مرحبا', clientMessageId: 'message-2' })
    await listGuestChatMessages('conversation/1', { cursor: 'message/1', limit: 5 })
    await listClientChatMessages('conversation/1', { cursor: 'message/1', limit: 5 })

    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      'http://api.test/api/v1/public/chat/conversations/current',
      'http://api.test/api/v1/public/chat/conversations',
      'http://api.test/api/v1/public/chat/conversations/current',
      'http://api.test/api/v1/public/me/chat/conversations/current',
      'http://api.test/api/v1/public/me/chat/conversations/conversation%2F1/claim',
      'http://api.test/api/v1/public/chat/conversations/conversation%2F1/messages',
      'http://api.test/api/v1/public/me/chat/conversations/conversation%2F1/messages',
      'http://api.test/api/v1/public/chat/conversations/conversation%2F1/messages?cursor=message%2F1&limit=5',
      'http://api.test/api/v1/public/me/chat/conversations/conversation%2F1/messages?cursor=message%2F1&limit=5',
    ])
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.credentials === 'include')).toBe(true)

    const mutations = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(mutations).toHaveLength(4)
    for (const [, init] of mutations) {
      expect(new Headers(init?.headers).get('x-csrf-token')).toBe('a'.repeat(64))
    }

    const bodies = vi.mocked(fetch).mock.calls
      .filter(([, init]) => init?.body)
      .map(([, init]) => JSON.parse(String(init?.body)))
    expect(bodies).toEqual([
      { guestName: 'سارة', language: 'ar' },
      {},
      { body: 'مرحبا', clientMessageId: 'message-1' },
      { body: 'مرحبا', clientMessageId: 'message-2' },
    ])
    expect(JSON.stringify(bodies)).not.toMatch(/clientId|senderId|senderType|guestToken/)
  })

  it('uses the real handoff and operation routes with CSRF on every mutation', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => wrapped(
      String(url).includes('/operations/') ? operation : conversation,
    ))

    await requestGuestChatHandoff('conversation/1', {
      guestName: 'سارة',
      guestPhone: '+966501234567',
    })
    await requestClientChatHandoff('conversation/1')
    await acknowledgeChatOperation('operation/1', 2)
    await confirmChatOperation('operation/1', 3)
    await declineChatOperation('operation/1', 4)

    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      'http://api.test/api/v1/public/chat/conversations/current',
      'http://api.test/api/v1/public/chat/conversations/conversation%2F1/handoff',
      'http://api.test/api/v1/public/me/chat/conversations/conversation%2F1/handoff',
      'http://api.test/api/v1/public/me/chat/operations/operation%2F1/acknowledge',
      'http://api.test/api/v1/public/me/chat/operations/operation%2F1/confirm',
      'http://api.test/api/v1/public/me/chat/operations/operation%2F1/decline',
    ])

    const mutationCalls = vi.mocked(fetch).mock.calls.slice(1)
    for (const [, init] of mutationCalls) {
      expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
      expect(new Headers(init?.headers).get('x-csrf-token')).toBe('a'.repeat(64))
    }
    expect(mutationCalls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { guestName: 'سارة', guestPhone: '+966501234567' },
      {},
      { expectedVersion: 2 },
      { expectedVersion: 3 },
      { expectedVersion: 4 },
    ])
  })
})
