import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(() => false),
  routerPush: vi.fn(),
  createGuest: vi.fn(),
  currentGuest: vi.fn(),
  currentClient: vi.fn(),
  selectedClient: vi.fn(),
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
  retryGuest: vi.fn(),
  retryClient: vi.fn(),
  setClient: vi.fn(),
  authIdentity: null as string | null,
  authSubscribers: new Set<() => void>(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock('@/features/auth/auth-store', () => ({
  isAuthenticated: mocks.isAuthenticated,
  getClient: () => mocks.authIdentity ? { id: mocks.authIdentity } : null,
  getAuthIdentitySnapshot: () => mocks.authIdentity,
  getServerAuthIdentitySnapshot: () => null,
  subscribeAuth: (listener: () => void) => {
    mocks.authSubscribers.add(listener);
    return () => mocks.authSubscribers.delete(listener);
  },
  setClient: (profile: { id: string } | null) => {
    mocks.setClient(profile);
    mocks.authIdentity = profile?.id ?? null;
    mocks.authSubscribers.forEach((listener) => listener());
  },
}));
vi.mock('./chat.api', () => ({
  createGuestChatConversationApi: mocks.createGuest,
  getCurrentGuestChatConversationApi: mocks.currentGuest,
  getCurrentClientChatConversationApi: mocks.currentClient,
  getClientChatConversationApi: mocks.selectedClient,
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
  retryGuestChatMessageApi: mocks.retryGuest,
  retryClientChatMessageApi: mocks.retryClient,
}));

import { LocaleProvider } from '@/features/locale/locale-provider';
import { ApiError } from '@sawaa/api-client';
import { AiChatWidget } from './ai-chat-widget';
import { markChatForReopen, readPendingChatResume, savePendingChatResume } from './chat-resume';

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
    mocks.authIdentity = null;
    mocks.authSubscribers.clear();
    mocks.currentGuest.mockResolvedValue(conversation);
    mocks.listGuest.mockResolvedValue({ data: [], meta: { limit: 50, nextCursor: null, hasMore: false } });
    mocks.currentClient.mockResolvedValue(conversation);
    mocks.selectedClient.mockResolvedValue(conversation);
    mocks.listClient.mockResolvedValue({ data: [], meta: { limit: 50, nextCursor: null, hasMore: false } });
    mocks.createGuest.mockResolvedValue(conversation);
    mocks.claimGuest.mockResolvedValue(conversation);
  });

  afterEach(() => vi.restoreAllMocks());

  it('inherits Sawaa design tokens without taking on page-level theme layout', () => {
    renderWidget('ar');

    const launcher = screen.getByRole('button', { name: 'فتح Sawaa Ai' });
    const tokenScope = launcher.closest('.theme-sawaa-tokens');
    expect(tokenScope).toBeTruthy();
    expect(tokenScope).not.toHaveClass('theme-sawaa');
    expect(tokenScope).toHaveClass('right-4', 'sm:right-6');
    expect(tokenScope).not.toHaveClass('end-4', 'sm:end-6');
    const icon = launcher.querySelector('[data-ai-chat-icon="ai-chat-bubble"]');
    expect(icon).toBeTruthy();
    expect(icon).toHaveTextContent('AI');
    expect(icon?.querySelector('.lucide-message-circle')).toBeTruthy();
  });

  it('bootstraps a first guest when current returns 401 because no guest cookie exists', async () => {
    mocks.currentGuest.mockRejectedValue(new ApiError(401, 'Guest chat cookie is required', {}, 'UNAUTHORIZED'));
    renderWidget('ar');

    fireEvent.click(screen.getByRole('button', { name: 'فتح Sawaa Ai' }));

    await waitFor(() => expect(mocks.createGuest).toHaveBeenCalledWith({ language: 'ar' }));
    expect(mocks.listGuest).toHaveBeenCalledWith('conversation-1', { limit: 50 });
    expect(screen.getByLabelText('الرسالة')).not.toBeDisabled();
  });

  it('opens an accessible Arabic RTL administrative shell and focuses its close control', async () => {
    renderWidget('ar');
    const launcher = screen.getByRole('button', { name: 'فتح Sawaa Ai' });
    launcher.focus();
    fireEvent.click(launcher);

    const dialog = await screen.findByRole('dialog', { name: 'Sawaa Ai' });
    expect(dialog).toHaveAttribute('dir', 'rtl');
    expect(dialog.className).toContain('sm:w-[26rem]');
    expect(dialog).toHaveClass('sm:right-6');
    expect(dialog).not.toHaveClass('sm:end-6');
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
    expect(screen.getByText('خدمة عملاء ذكية لخدمات المركز والمعالجين والمواعيد والحجوزات.')).toBeTruthy();
  });

  it('uses English LTR labels and restores launcher focus when Escape closes the dialog', async () => {
    renderWidget('en');
    const launcher = screen.getByRole('button', { name: 'Open Sawaa Ai' });
    fireEvent.click(launcher);
    const dialog = await screen.findByRole('dialog', { name: 'Sawaa Ai' });

    expect(dialog).toHaveAttribute('dir', 'ltr');
    await waitFor(() => expect(mocks.listGuest).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(launcher).toHaveFocus());
  });

  it('reopens after login with only a one-shot flag and no credential in browser storage', async () => {
    mocks.isAuthenticated.mockReturnValue(true);
    mocks.authIdentity = 'client-1';
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

    await screen.findByRole('dialog', { name: 'Sawaa Ai' });
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

  it('removes the one-shot chat resume query while preserving other query parameters', async () => {
    window.history.replaceState(null, '', '/?foo=1&chat=resume');
    renderWidget('en');
    await screen.findByRole('dialog', { name: 'Sawaa Ai' });
    expect(window.location.search).toBe('?foo=1');
  });

  it('supersedes a stale awaiting-auth card with the resumed operation after claim', async () => {
    mocks.authIdentity = 'client-1';
    const staleOperation = {
      id: 'operation-resume', type: 'CREATE_BOOKING' as const, status: 'AWAITING_AUTH' as const,
      version: 0, requiredConfirmations: 1, confirmationCount: 0,
      expiresAt: '2026-08-14T12:00:00.000Z', bookingId: null, errorCode: null,
      summary: { action: 'LOGIN_REQUIRED' as const, serviceName: 'Family session' },
    };
    const resumedOperation = { ...staleOperation, status: 'AWAITING_CONFIRMATION' as const, version: 1 };
    savePendingChatResume('conversation-1');
    markChatForReopen();
    mocks.claimGuest.mockResolvedValue({ ...conversation, resumedOperations: [resumedOperation] });
    mocks.listClient.mockResolvedValue({
      data: [{
        id: 'stale-card', conversationId: 'conversation-1', senderType: 'AI', kind: 'ACTION_CARD',
        body: 'Sign in', clientMessageId: null, createdAt: '2026-08-13T09:00:00.000Z',
        metadata: { action: 'CHAT_OPERATION', operation: staleOperation },
      }],
      meta: { limit: 50, nextCursor: null, hasMore: false },
    });
    renderWidget('en');

    expect(await screen.findByText('Final confirmation')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in and continue' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirm request' })).toBeTruthy();
  });

  it('clears A immediately across logout/login and ignores late guest work before loading B', async () => {
    mocks.authIdentity = 'client-a';
    mocks.isAuthenticated.mockReturnValue(true);
    mocks.currentClient.mockImplementation(async () => ({ ...conversation, id: `conversation-${mocks.authIdentity}` }));
    mocks.listClient.mockImplementation(async (currentId: string) => ({
      data: [{
        id: `message-${currentId}`,
        conversationId: currentId,
        clientMessageId: null,
        createdAt: '2026-08-13T09:00:00.000Z',
        senderType: 'CLIENT' as const,
        kind: 'TEXT' as const,
        body: currentId === 'conversation-client-a' ? 'A private message' : 'B private message',
      }],
      meta: { limit: 50, nextCursor: null, hasMore: false },
    }));
    let resolveGuest!: (value: typeof conversation) => void;
    mocks.currentGuest.mockRejectedValue(new ApiError(401, 'Guest chat cookie is required', {}, 'UNAUTHORIZED'));
    mocks.createGuest.mockReturnValue(new Promise((resolve) => { resolveGuest = resolve; }));
    renderWidget('en');
    fireEvent.click(screen.getByRole('button', { name: 'Open Sawaa Ai' }));
    expect(await screen.findByText('A private message')).toBeTruthy();

    act(() => {
      mocks.authIdentity = null;
      mocks.isAuthenticated.mockReturnValue(false);
      mocks.authSubscribers.forEach((listener) => listener());
    });
    expect(screen.queryByText('A private message')).toBeNull();

    act(() => {
      mocks.authIdentity = 'client-b';
      mocks.isAuthenticated.mockReturnValue(true);
      mocks.authSubscribers.forEach((listener) => listener());
    });
    expect(await screen.findByText('B private message')).toBeTruthy();
    await act(async () => resolveGuest(conversation));
    expect(screen.queryByText('A private message')).toBeNull();
    expect(screen.getByText('B private message')).toBeTruthy();
  });

  it('retries a preserved pending claim and never creates a replacement conversation on claim failure', async () => {
    mocks.authIdentity = 'client-1';
    mocks.isAuthenticated.mockReturnValue(true);
    savePendingChatResume('conversation-pending');
    markChatForReopen();
    mocks.claimGuest
      .mockRejectedValueOnce(new Error('temporary claim failure'))
      .mockResolvedValueOnce({ ...conversation, id: 'conversation-pending' });
    renderWidget('en');

    expect(await screen.findByText('Could not resume your conversation. Try again.')).toBeTruthy();
    expect(readPendingChatResume()).toBe('conversation-pending');
    expect(mocks.createGuest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mocks.claimGuest).toHaveBeenCalledTimes(2));
    expect(readPendingChatResume()).toBeNull();
    expect(mocks.createGuest).not.toHaveBeenCalled();
  });

  it('surfaces polling failures instead of silently swallowing them', async () => {
    mocks.authIdentity = 'client-1';
    mocks.isAuthenticated.mockReturnValue(true);
    let poll: (() => void) | null = null;
    vi.spyOn(window, 'setInterval').mockImplementation((handler: TimerHandler) => {
      poll = handler as () => void;
      return 1 as unknown as ReturnType<typeof setInterval>;
    });
    renderWidget('en');
    fireEvent.click(screen.getByRole('button', { name: 'Open Sawaa Ai' }));
    await waitFor(() => expect(mocks.listClient).toHaveBeenCalledTimes(1));
    mocks.listClient.mockRejectedValueOnce(new Error('network down'));

    act(() => poll?.());

    expect(await screen.findByText('Conversation updates paused. Try again.')).toBeTruthy();
  });

  it('opens exactly the in-memory account-selected conversation instead of falling back to current', async () => {
    mocks.authIdentity = 'client-1';
    mocks.isAuthenticated.mockReturnValue(true);
    mocks.currentClient.mockResolvedValue({ ...conversation, id: 'conversation-current' });
    mocks.selectedClient.mockResolvedValue({ ...conversation, id: 'conversation-a' });
    mocks.listClient.mockResolvedValue({ data: [], meta: { limit: 50, nextCursor: null, hasMore: false } });
    renderWidget('en');

    act(() => window.dispatchEvent(new CustomEvent('sawaa:open-administrative-chat', {
      detail: { conversationId: 'conversation-a' },
    })));

    await screen.findByRole('dialog', { name: 'Sawaa Ai' });
    await waitFor(() => expect(mocks.selectedClient).toHaveBeenCalledWith('conversation-a'));
    expect(mocks.currentClient).not.toHaveBeenCalled();
    expect(mocks.listClient).toHaveBeenCalledWith('conversation-a', { limit: 50 });
  });
});
