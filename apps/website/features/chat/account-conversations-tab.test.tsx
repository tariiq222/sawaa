import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listConversations = vi.fn();
const listMessages = vi.fn();

vi.mock('./chat.api', () => ({
  listClientChatConversationsApi: (...args: unknown[]) => listConversations(...args),
  listClientChatMessagesApi: (...args: unknown[]) => listMessages(...args),
}));

vi.mock('./chat-message-list', () => ({
  ChatMessageList: ({ readOnly }: { readOnly?: boolean }) => <div data-testid="chat-message-list">{readOnly ? 'read-only' : 'interactive'}</div>,
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
    listConversations.mockResolvedValue({ data: [conversation], meta: { limit: 50, nextCursor: null, hasMore: false } });
    listMessages.mockResolvedValue({ data: [], meta: { limit: 100, nextCursor: null, hasMore: false } });
    renderTab();

    expect(await screen.findByText('Your booking is confirmed')).toBeTruthy();
    fireEvent.click(screen.getByText('Your booking is confirmed'));
    await waitFor(() => expect(listMessages).toHaveBeenCalledWith('conversation-1', { limit: 100 }));
    expect(screen.getByText('This conversation is closed and available as read-only.')).toBeTruthy();
    expect(screen.getByTestId('chat-message-list').textContent).toBe('read-only');
    expect(screen.queryByRole('button', { name: 'Continue with assistant' })).toBeNull();
  });

  it('opens the administrative assistant from an active detail without browser-supplied identity', async () => {
    const active = { ...conversation, status: 'AI_ACTIVE' as const };
    listConversations.mockResolvedValue({ data: [active], meta: { limit: 50, nextCursor: null, hasMore: false } });
    listMessages.mockResolvedValue({ data: [], meta: { limit: 100, nextCursor: null, hasMore: false } });
    const opened = vi.fn();
    window.addEventListener('sawaa:open-administrative-chat', opened);
    renderTab();

    fireEvent.click(await screen.findByText('Your booking is confirmed'));
    await screen.findByRole('button', { name: 'Continue with assistant' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with assistant' }));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener('sawaa:open-administrative-chat', opened);
  });

  it('shows a recoverable empty and error state', async () => {
    listConversations.mockResolvedValueOnce({ data: [], meta: { limit: 50, nextCursor: null, hasMore: false } });
    const empty = renderTab();
    expect(await screen.findByText('No conversations yet')).toBeTruthy();
    empty.unmount();

    listConversations.mockRejectedValueOnce(new Error('offline'));
    renderTab();
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load conversations. Try again.');
  });
});
