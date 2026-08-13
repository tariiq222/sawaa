import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  onRetryAssistant: vi.fn(),
};

function renderList(
  messages: ChatMessage[],
  authenticated = false,
  callbackOverrides: Partial<typeof callbacks> = {},
  readOnly = false,
) {
  render(
    <LocaleProvider locale="ar">
      <ChatMessageList
        messages={messages}
        isAuthenticated={authenticated}
        isLoading={false}
        readOnly={readOnly}
        {...callbacks}
        {...callbackOverrides}
      />
    </LocaleProvider>,
  );
}

describe('ChatMessageList', () => {
  beforeEach(() => vi.clearAllMocks());

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

  it('distinguishes the client, administrative assistant, reception, system, and action outcomes', () => {
    renderList([
      { ...baseMessage, id: 'client', senderType: 'CLIENT', kind: 'TEXT', body: 'رسالة العميل' },
      { ...baseMessage, id: 'assistant', senderType: 'AI', kind: 'TEXT', body: 'رد المساعد' },
      { ...baseMessage, id: 'reception', senderType: 'EMPLOYEE', kind: 'TEXT', body: 'رد الاستقبال' },
      { ...baseMessage, id: 'system', senderType: 'SYSTEM', kind: 'SYSTEM_EVENT', body: 'تحديث الحالة' },
      {
        ...baseMessage,
        id: 'action',
        senderType: 'AI',
        kind: 'ACTION_CARD',
        body: 'طلب إداري',
        metadata: {
          action: 'CHAT_OPERATION',
          operation: {
            id: 'operation-1', type: 'CREATE_BOOKING', status: 'AWAITING_CONFIRMATION', version: 1,
            requiredConfirmations: 1, confirmationCount: 0, expiresAt: '2026-08-15T00:00:00.000Z', bookingId: null, errorCode: null,
            summary: { serviceName: 'استشارة' },
          },
        },
      },
      {
        ...baseMessage,
        id: 'result',
        senderType: 'AI',
        kind: 'OPERATION_RESULT',
        body: 'اكتمل الإجراء',
        metadata: { operationId: 'operation-1', type: 'CREATE_BOOKING', status: 'SUCCEEDED', outcome: 'BOOKING_CREATED' },
      },
    ]);

    expect(screen.getByLabelText('المستفيد')).toHaveTextContent('رسالة العميل');
    expect(screen.getByLabelText('مساعد سواء الإداري')).toHaveTextContent('رد المساعد');
    expect(screen.getByLabelText('فريق الاستقبال')).toHaveTextContent('رد الاستقبال');
    expect(screen.getByLabelText('تحديث النظام')).toHaveTextContent('تحديث الحالة');
    expect(screen.getByLabelText('إجراء مطلوب')).toHaveTextContent('استشارة');
    expect(screen.getByLabelText('نتيجة الإجراء')).toHaveTextContent('اكتمل الإجراء');
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

  it('guards authenticated handoff against double submission while pending', () => {
    const handoff = handoffMessage();
    const onClientHandoff = vi.fn(() => new Promise<void>(() => undefined));
    renderList([handoff], true, { onClientHandoff });

    const button = screen.getByRole('button', { name: 'التحويل إلى الاستقبال' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onClientHandoff).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });

  it('handles an authenticated handoff rejection and shows a recoverable error', async () => {
    const onClientHandoff = vi.fn().mockRejectedValue(new Error('network'));
    renderList([handoffMessage()], true, { onClientHandoff });

    fireEvent.click(screen.getByRole('button', { name: 'التحويل إلى الاستقبال' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر التحويل إلى الاستقبال. حاول مرة أخرى.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'التحويل إلى الاستقبال' })).not.toBeDisabled());
  });

  it('shows a visible authenticated handoff success', async () => {
    const onClientHandoff = vi.fn().mockResolvedValue(undefined);
    renderList([handoffMessage()], true, { onClientHandoff });
    fireEvent.click(screen.getByRole('button', { name: 'التحويل إلى الاستقبال' }));
    expect(await screen.findByRole('status')).toHaveTextContent('تم تحويل الطلب إلى فريق الاستقبال.');
  });

  it('offers a bounded assistant retry and reception handoff without provider details', () => {
    const onRetryAssistant = vi.fn(() => new Promise<void>(() => undefined));
    renderList([{
      ...baseMessage,
      id: 'message-retry',
      senderType: 'VISITOR',
      kind: 'TEXT',
      body: 'ساعات العمل؟',
      metadata: { action: 'ASSISTANT_RECOVERY', canRetry: true },
    }], false, { onRetryAssistant });
    const retry = screen.getByRole('button', { name: 'إعادة محاولة المساعد' });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(onRetryAssistant).toHaveBeenCalledTimes(1);
    expect(retry).toBeDisabled();
    expect(screen.getByRole('button', { name: 'التحويل إلى الاستقبال' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/provider|خطأ داخلي/i);
  });

  it('does not render history action controls in read-only mode', () => {
    renderList([handoffMessage()], true, {}, true);
    expect(screen.queryByRole('button', { name: 'التحويل إلى الاستقبال' })).toBeNull();
  });
});

function handoffMessage(): ChatMessage {
  return {
    ...baseMessage,
    id: 'message-handoff',
    senderType: 'AI',
    kind: 'TEXT',
    body: 'Reception is available.',
    metadata: { action: 'OFFER_HANDOFF', reason: 'USER_REQUESTED' },
  };
}
