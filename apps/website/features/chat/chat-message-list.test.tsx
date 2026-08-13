import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/features/locale/locale-provider';
import type { ChatMessage } from './chat.types';
import { ChatMessageList } from './chat-message-list';

const baseMessage = {
  conversationId: 'conversation-1',
  clientMessageId: null,
  createdAt: '2026-08-13T09:00:00.000Z',
};

const callbacks = {
  onLoginRequired: vi.fn(),
  onAcknowledge: vi.fn(),
  onConfirm: vi.fn(),
  onDecline: vi.fn(),
  onGuestHandoff: vi.fn(),
  onClientHandoff: vi.fn(),
};

function renderList(messages: ChatMessage[], authenticated = false) {
  render(
    <LocaleProvider locale="ar">
      <ChatMessageList
        messages={messages}
        isAuthenticated={authenticated}
        isLoading={false}
        {...callbacks}
      />
    </LocaleProvider>,
  );
}

describe('ChatMessageList', () => {
  it('renders server text as inert text instead of executable markup', () => {
    renderList([{
      ...baseMessage,
      id: 'message-1',
      senderType: 'AI',
      kind: 'TEXT',
      body: '<img src=x onerror=alert(1)>معلومة إدارية',
    }]);

    expect(screen.getByText('<img src=x onerror=alert(1)>معلومة إدارية')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows name and mobile fields only when a guest accepts handoff', () => {
    const handoff: ChatMessage = {
      ...baseMessage,
      id: 'message-2',
      senderType: 'AI',
      kind: 'TEXT',
      body: 'يمكنني تحويلك إلى الاستقبال.',
      metadata: { action: 'OFFER_HANDOFF', reason: 'USER_REQUESTED' },
    };
    renderList([handoff]);

    fireEvent.click(screen.getByRole('button', { name: 'التحويل إلى الاستقبال' }));
    expect(screen.getByLabelText('الاسم')).toBeTruthy();
    expect(screen.getByLabelText('رقم الجوال')).toBeTruthy();
  });

  it('does not ask an authenticated client for guest identity during handoff', () => {
    renderList([{
      ...baseMessage,
      id: 'message-3',
      senderType: 'AI',
      kind: 'TEXT',
      body: 'Reception is available.',
      metadata: { action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' },
    }], true);

    expect(screen.queryByLabelText('الاسم')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'التحويل إلى الاستقبال' }));
    expect(callbacks.onClientHandoff).toHaveBeenCalledTimes(1);
  });
});
