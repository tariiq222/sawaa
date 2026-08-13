import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listConversations = vi.fn();
const listMessages = vi.fn();

vi.mock('./chat.api', () => ({
  listClientChatConversationsApi: (...args: unknown[]) => listConversations(...args),
  listClientChatMessagesApi: (...args: unknown[]) => listMessages(...args),
}));

vi.mock('./chat-message-list', () => ({
  ChatMessageList: ({ readOnly, messages }: { readOnly?: boolean; messages: Array<{ body: string }> }) => <div data-testid="chat-message-list">{readOnly ? 'read-only' : 'interactive'} {messages.map((message) => message.body).join(' ')}</div>,
}));

import { AccountConversationsTab } from './account-conversations-tab';
import { LocaleProvider } from '@/features/locale/locale-provider';

const conversation = {
  id: 'conversation-1', status: 'CLOSED' as const,
  createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T10:00:00.000Z', lastMessageAt: '2026-08-13T10:00:00.000Z',
  lastMessage: { preview: 'Your booking is confirmed', senderType: 'AI' as const, kind: 'TEXT' as const },
};

function renderTab() {
  return render(<LocaleProvider locale="en"><AccountConversationsTab /></LocaleProvider>);
}

describe('AccountConversationsTab', () => {
  beforeEach(() => {
    listConversations.mockReset();
    listMessages.mockReset();
  });

  it('shows the owned conversation history and reads a closed conversation without exposing a composer', async () => {
    listConversations.mockResolvedValue({ data: [conversation], meta: { limit: 20, nextCursor: null, hasMore: false } });
    listMessages.mockResolvedValue({ data: [], meta: { limit: 50, nextCursor: null, hasMore: false } });
    renderTab();

    expect(await screen.findByText('Your booking is confirmed')).toBeTruthy();
    fireEvent.click(screen.getByText('Your booking is confirmed'));
    await waitFor(() => expect(listMessages).toHaveBeenCalledWith('conversation-1', { limit: 50 }, expect.anything()));
    expect(screen.getByText('This conversation is closed and available as read-only.')).toBeTruthy();
    expect(screen.getByTestId('chat-message-list').textContent).toContain('read-only');
    expect(screen.queryByRole('button', { name: 'Continue with assistant' })).toBeNull();
  });

  it('announces initial history loading accessibly', () => {
    listConversations.mockReturnValue(new Promise(() => undefined));
    renderTab();

    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('opens the administrative assistant from an active detail without browser-supplied identity', async () => {
    const active = { ...conversation, status: 'AI_ACTIVE' as const };
    listConversations.mockResolvedValue({ data: [active], meta: { limit: 20, nextCursor: null, hasMore: false } });
    listMessages.mockResolvedValue({ data: [], meta: { limit: 50, nextCursor: null, hasMore: false } });
    const opened = vi.fn();
    window.addEventListener('sawaa:open-administrative-chat', opened);
    renderTab();

    fireEvent.click(await screen.findByText('Your booking is confirmed'));
    await screen.findByRole('button', { name: 'Continue with assistant' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with assistant' }));
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ detail: { conversationId: 'conversation-1' } }));
    window.removeEventListener('sawaa:open-administrative-chat', opened);
  });

  it('shows a recoverable empty and error state', async () => {
    listConversations.mockResolvedValueOnce({ data: [], meta: { limit: 20, nextCursor: null, hasMore: false } });
    const empty = renderTab();
    expect(await screen.findByText('No conversations yet')).toBeTruthy();
    empty.unmount();

    listConversations.mockRejectedValueOnce(new Error('offline'));
    renderTab();
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load conversations. Try again.');
  });

  it('loads every conversation page with a client-owned cursor', async () => {
    const older = { ...conversation, id: 'conversation-older', lastMessage: { ...conversation.lastMessage, preview: 'Older message' } };
    listConversations
      .mockResolvedValueOnce({ data: [conversation], meta: { limit: 20, nextCursor: 'conversation-1', hasMore: true } })
      .mockResolvedValueOnce({ data: [older], meta: { limit: 20, nextCursor: null, hasMore: false } });
    renderTab();

    await screen.findByText('Your booking is confirmed');
    fireEvent.click(screen.getByRole('button', { name: 'Load more conversations' }));
    await screen.findByText('Older message');
    expect(listConversations).toHaveBeenLastCalledWith({ limit: 20, cursor: 'conversation-1' });
    expect(screen.queryByRole('button', { name: 'Load more conversations' })).toBeNull();
  });

  it('loads older message pages for the selected conversation', async () => {
    listConversations.mockResolvedValue({ data: [conversation], meta: { limit: 20, nextCursor: null, hasMore: false } });
    listMessages
      .mockResolvedValueOnce({ data: [{ id: 'm-new', conversationId: 'conversation-1', senderType: 'AI', kind: 'TEXT', body: 'Newest', clientMessageId: null, createdAt: '2026-08-14T01:00:00.000Z' }], meta: { limit: 50, nextCursor: 'm-new', hasMore: true } })
      .mockResolvedValueOnce({ data: [{ id: 'm-old', conversationId: 'conversation-1', senderType: 'AI', kind: 'TEXT', body: 'Older', clientMessageId: null, createdAt: '2026-08-14T00:00:00.000Z' }], meta: { limit: 50, nextCursor: null, hasMore: false } });
    renderTab();

    fireEvent.click(await screen.findByText('Your booking is confirmed'));
    await waitFor(() => expect(screen.getByTestId('chat-message-list').textContent).toContain('Newest'));
    fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
    await waitFor(() => expect(screen.getByTestId('chat-message-list').textContent).toContain('Older'));
    expect(listMessages).toHaveBeenLastCalledWith('conversation-1', { limit: 50, cursor: 'm-new' }, expect.anything());
  });

  it('keeps B detail when a slower A request resolves after selection changes', async () => {
    const a = { ...conversation, id: 'conversation-a', lastMessage: { ...conversation.lastMessage, preview: 'A preview' } };
    const b = { ...conversation, id: 'conversation-b', status: 'STAFF_ACTIVE' as const, lastMessage: { ...conversation.lastMessage, preview: 'B preview' } };
    let resolveA!: (value: unknown) => void;
    listConversations.mockResolvedValue({ data: [a, b], meta: { limit: 20, nextCursor: null, hasMore: false } });
    listMessages
      .mockReturnValueOnce(new Promise((resolve) => { resolveA = resolve; }))
      .mockResolvedValueOnce({ data: [{ id: 'm-b', conversationId: 'conversation-b', senderType: 'STAFF', kind: 'TEXT', body: 'B detail', clientMessageId: null, createdAt: '2026-08-14T01:00:00.000Z' }], meta: { limit: 50, nextCursor: null, hasMore: false } });
    renderTab();

    fireEvent.click(await screen.findByText('A preview'));
    fireEvent.click(screen.getByText('All conversations'));
    fireEvent.click(screen.getByText('B preview'));
    await waitFor(() => expect(screen.getByTestId('chat-message-list').textContent).toContain('B detail'));
    resolveA({ data: [{ id: 'm-a', conversationId: 'conversation-a', senderType: 'AI', kind: 'TEXT', body: 'A detail', clientMessageId: null, createdAt: '2026-08-14T00:00:00.000Z' }], meta: { limit: 50, nextCursor: null, hasMore: false } });
    await waitFor(() => expect(screen.queryByText('A detail')).toBeNull());
    expect(screen.getByTestId('chat-message-list').textContent).toContain('B detail');
  });

  it('offers a retry when the selected conversation detail cannot be loaded', async () => {
    listConversations.mockResolvedValue({ data: [conversation], meta: { limit: 20, nextCursor: null, hasMore: false } });
    listMessages
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: [{ id: 'm-retry', conversationId: 'conversation-1', senderType: 'AI', kind: 'TEXT', body: 'Recovered detail', clientMessageId: null, createdAt: '2026-08-14T01:00:00.000Z' }], meta: { limit: 50, nextCursor: null, hasMore: false } });
    renderTab();

    fireEvent.click(await screen.findByText('Your booking is confirmed'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('chat-message-list').textContent).toContain('Recovered detail'));
    expect(listMessages).toHaveBeenCalledTimes(2);
  });

  it('renders the active, waiting, staff, and closed statuses', async () => {
    listConversations.mockResolvedValue({
      data: [
        { ...conversation, id: 'active', status: 'AI_ACTIVE', lastMessage: { ...conversation.lastMessage, preview: 'Active' } },
        { ...conversation, id: 'waiting', status: 'WAITING_FOR_STAFF', lastMessage: { ...conversation.lastMessage, preview: 'Waiting' } },
        { ...conversation, id: 'staff', status: 'STAFF_ACTIVE', lastMessage: { ...conversation.lastMessage, preview: 'Staff' } },
        { ...conversation, id: 'closed', status: 'CLOSED', lastMessage: { ...conversation.lastMessage, preview: 'Closed' } },
      ], meta: { limit: 20, nextCursor: null, hasMore: false },
    });
    renderTab();
    expect(await screen.findByText('Assistant available')).toBeTruthy();
    expect(screen.getByText('Waiting for reception')).toBeTruthy();
    expect(screen.getByText('Reception is assisting')).toBeTruthy();
    expect(screen.getAllByText('Closed')).toHaveLength(2);
  });
});
