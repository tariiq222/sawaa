import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setChatBaseUrl: vi.fn(),
  createGuestChatConversation: vi.fn(),
  getCurrentGuestChatConversation: vi.fn(),
  getCurrentClientChatConversation: vi.fn(),
  claimGuestChatConversation: vi.fn(),
  sendGuestChatMessage: vi.fn(),
  sendClientChatMessage: vi.fn(),
  listGuestChatMessages: vi.fn(),
  listClientChatMessages: vi.fn(),
  requestGuestChatHandoff: vi.fn(),
  requestClientChatHandoff: vi.fn(),
  retryGuestChatMessage: vi.fn(),
  retryClientChatMessage: vi.fn(),
  acknowledgeChatOperation: vi.fn(),
  confirmChatOperation: vi.fn(),
  declineChatOperation: vi.fn(),
  getApiBase: vi.fn(() => 'http://api.local/api/v1'),
}))

vi.mock('@sawaa/api-client', () => mocks)
vi.mock('@/lib/api-base', () => ({ getApiBase: mocks.getApiBase }))

import {
  acknowledgeChatOperationApi,
  claimGuestChatConversationApi,
  confirmChatOperationApi,
  createGuestChatConversationApi,
  declineChatOperationApi,
  getCurrentClientChatConversationApi,
  getCurrentGuestChatConversationApi,
  listClientChatMessagesApi,
  listGuestChatMessagesApi,
  requestClientChatHandoffApi,
  requestGuestChatHandoffApi,
  retryGuestChatMessageApi,
  retryClientChatMessageApi,
  sendClientChatMessageApi,
  sendGuestChatMessageApi,
} from './chat.api'

describe('chat website API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initialises the chat client once and forwards conversation and message calls', async () => {
    await createGuestChatConversationApi({ language: 'ar' })
    await getCurrentGuestChatConversationApi()
    await getCurrentClientChatConversationApi()
    await claimGuestChatConversationApi('conversation-1')
    await sendGuestChatMessageApi('conversation-1', { body: 'مرحبا', clientMessageId: 'message-1' })
    await sendClientChatMessageApi('conversation-1', { body: 'أهلًا', clientMessageId: 'message-2' })
    await listGuestChatMessagesApi('conversation-1', { limit: 10 })
    await listClientChatMessagesApi('conversation-1', { cursor: 'message-1' })
    await retryGuestChatMessageApi('conversation-1', 'message-1')
    await retryClientChatMessageApi('conversation-1', 'message-1')

    expect(mocks.setChatBaseUrl).toHaveBeenCalledTimes(1)
    expect(mocks.setChatBaseUrl).toHaveBeenCalledWith('http://api.local/api/v1')
    expect(mocks.createGuestChatConversation).toHaveBeenCalledWith({ language: 'ar' })
    expect(mocks.getCurrentGuestChatConversation).toHaveBeenCalledWith()
    expect(mocks.getCurrentClientChatConversation).toHaveBeenCalledWith()
    expect(mocks.claimGuestChatConversation).toHaveBeenCalledWith('conversation-1')
    expect(mocks.sendGuestChatMessage).toHaveBeenCalledWith(
      'conversation-1',
      { body: 'مرحبا', clientMessageId: 'message-1' },
    )
    expect(mocks.sendClientChatMessage).toHaveBeenCalledWith(
      'conversation-1',
      { body: 'أهلًا', clientMessageId: 'message-2' },
    )
    expect(mocks.listGuestChatMessages).toHaveBeenCalledWith('conversation-1', { limit: 10 })
    expect(mocks.listClientChatMessages).toHaveBeenCalledWith('conversation-1', { cursor: 'message-1' })
    expect(mocks.retryGuestChatMessage).toHaveBeenCalledWith('conversation-1', 'message-1')
    expect(mocks.retryClientChatMessage).toHaveBeenCalledWith('conversation-1', 'message-1')
  })

  it('forwards handoff and operation actions without adding identity fields', async () => {
    await requestGuestChatHandoffApi('conversation-1', {
      guestName: 'سارة',
      guestPhone: '+966501234567',
    })
    await requestClientChatHandoffApi('conversation-1')
    await acknowledgeChatOperationApi('operation-1', 1)
    await confirmChatOperationApi('operation-1', 2)
    await declineChatOperationApi('operation-1', 3)

    expect(mocks.requestGuestChatHandoff).toHaveBeenCalledWith('conversation-1', {
      guestName: 'سارة',
      guestPhone: '+966501234567',
    })
    expect(mocks.requestClientChatHandoff).toHaveBeenCalledWith('conversation-1')
    expect(mocks.acknowledgeChatOperation).toHaveBeenCalledWith('operation-1', 1)
    expect(mocks.confirmChatOperation).toHaveBeenCalledWith('operation-1', 2)
    expect(mocks.declineChatOperation).toHaveBeenCalledWith('operation-1', 3)
  })
})
