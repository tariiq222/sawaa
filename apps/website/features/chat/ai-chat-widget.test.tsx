import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(() => false),
  routerPush: vi.fn(),
  createGuest: vi.fn(),
  currentGuest: vi.fn(),
  currentClient: vi.fn(),
  claimGuest: vi.fn(),
  listGuest: vi.fn(),
  listClient: vi.fn(),
  sendGuest: vi.fn(),
  sendClient: vi.fn(),
  guestHandoff: vi.fn(),
  clientHandoff: vi.fn(),
  acknowledge: vi.fn(),
  confirm: vi.fn(),
  decline: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock('@/features/auth/auth-store', () => ({ isAuthenticated: mocks.isAuthenticated }));
vi.mock('./chat.api', () => ({
  createGuestChatConversationApi: mocks.createGuest,
  getCurrentGuestChatConversationApi: mocks.currentGuest,
  getCurrentClientChatConversationApi: mocks.currentClient,
  claimGuestChatConversationApi: mocks.claimGuest,
  listGuestChatMessagesApi: mocks.listGuest,
  listClientChatMessagesApi: mocks.listClient,
  sendGuestChatMessageApi: mocks.sendGuest,
  sendClientChatMessageApi: mocks.sendClient,
  requestGuestChatHandoffApi: mocks.guestHandoff,
  requestClientChatHandoffApi: mocks.clientHandoff,
  acknowledgeChatOperationApi: mocks.acknowledge,
  confirmChatOperationApi: mocks.confirm,
  declineChatOperationApi: mocks.decline,
}));

import { LocaleProvider } from '@/features/locale/locale-provider';
import { AiChatWidget } from './ai-chat-widget';
import { markChatForReopen } from './chat-resume';

const conversation = {
  id: 'conversation-1',
  employeeId: null,
  isAiChat: true,
  status: 'AI_ACTIVE' as const,
  language: 'ar',
  createdAt: '2026-08-13T09:00:00.000Z',
  updatedAt: '2026-08-13T09:00:00.000Z',
};

function renderWidget(locale: 'ar' | 'en' = 'ar') {
  return render(
    <LocaleProvider locale={locale}>
      <AiChatWidget />
    </LocaleProvider>,
  );
}

describe('AiChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    mocks.isAuthenticated.mockReturnValue(false);
    mocks.currentGuest.mockResolvedValue(conversation);
    mocks.listGuest.mockResolvedValue({ data: [], meta: { limit: 50, nextCursor: null, hasMore: false } });
    mocks.currentClient.mockResolvedValue(conversation);
    mocks.listClient.mockResolvedValue({ data: [], meta: { limit: 50, nextCursor: null, hasMore: false } });
  });

  it('opens an accessible Arabic RTL administrative shell and focuses its close control', async () => {
    renderWidget('ar');
    const launcher = screen.getByRole('button', { name: 'فتح مساعد سواء الإداري' });
    launcher.focus();
    fireEvent.click(launcher);

    const dialog = await screen.findByRole('dialog', { name: 'مساعد سواء الإداري' });
    expect(dialog).toHaveAttribute('dir', 'rtl');
    expect(dialog.className).toContain('sm:w-[26rem]');
    expect(dialog.className).toContain('motion-reduce:transition-none');
    const close = screen.getByRole('button', { name: 'إغلاق المحادثة' });
    await waitFor(() => expect(close).toHaveFocus());
    const composer = await screen.findByLabelText('الرسالة');
    await waitFor(() => expect(composer).not.toBeDisabled());
    composer.focus();
    fireEvent.keyDown(composer, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(composer).toHaveFocus();
    expect(screen.getByText('للمعلومات والخدمات الإدارية فقط، وليس للتقييم أو الاستشارة العلاجية.')).toBeTruthy();
  });

  it('uses English LTR labels and restores launcher focus when Escape closes the dialog', async () => {
    renderWidget('en');
    const launcher = screen.getByRole('button', { name: 'Open Sawaa administrative assistant' });
    fireEvent.click(launcher);
    const dialog = await screen.findByRole('dialog', { name: 'Sawaa administrative assistant' });

    expect(dialog).toHaveAttribute('dir', 'ltr');
    await waitFor(() => expect(mocks.listGuest).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(launcher).toHaveFocus());
  });

  it('reopens after login with only a one-shot flag and no credential in browser storage', async () => {
    mocks.isAuthenticated.mockReturnValue(true);
    mocks.listClient.mockResolvedValue({
      data: [{
        id: 'message-operation',
        conversationId: 'conversation-1',
        clientMessageId: null,
        createdAt: '2026-08-13T09:00:00.000Z',
        senderType: 'AI',
        kind: 'ACTION_CARD',
        body: 'Confirm the request',
        metadata: {
          action: 'CHAT_OPERATION',
          operation: {
            id: 'operation-1',
            type: 'CREATE_BOOKING',
            status: 'AWAITING_CONFIRMATION',
            version: 2,
            requiredConfirmations: 2,
            confirmationCount: 1,
            expiresAt: '2026-08-14T12:00:00.000Z',
            bookingId: null,
            errorCode: null,
            summary: { serviceName: 'جلسة إرشاد أسري' },
          },
        },
      }],
      meta: { limit: 50, nextCursor: null, hasMore: false },
    });
    markChatForReopen();
    renderWidget('ar');

    await screen.findByRole('dialog', { name: 'مساعد سواء الإداري' });
    await waitFor(() => expect(mocks.currentClient).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('التأكيد النهائي')).toBeTruthy();
    expect(window.sessionStorage.length).toBe(0);
    const browserStorage = [window.localStorage, window.sessionStorage]
      .flatMap((storage) => Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? '';
        return `${key}:${storage.getItem(key) ?? ''}`;
      }))
      .join(' ');
    expect(browserStorage).not.toMatch(/token|bearer|secret/i);
  });
});
