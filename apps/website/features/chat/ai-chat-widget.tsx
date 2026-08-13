'use client';

import { ApiError } from '@sawaa/api-client';
import { Bot, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import {
  getAuthIdentitySnapshot,
  getServerAuthIdentitySnapshot,
  subscribeAuth,
  clearAuth,
} from '@/features/auth/auth-store';
import { t as translate } from '@/features/locale/dictionary';
import { useLocale, useT } from '@/features/locale/locale-provider';
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
  retryClientChatMessageApi,
  retryGuestChatMessageApi,
  sendClientChatMessageApi,
  sendGuestChatMessageApi,
} from './chat.api';
import { ChatComposer } from './chat-composer';
import { ChatMessageList } from './chat-message-list';
import {
  clearPendingChatResume,
  consumeChatReopen,
  readPendingChatResume,
  savePendingChatResume,
} from './chat-resume';
import type { ChatConversationDetail, ChatMessage, ChatOperation } from './chat.types';

const MESSAGE_LIMIT = 50;

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const authIdentity = useSyncExternalStore(
    subscribeAuth,
    getAuthIdentitySnapshot,
    getServerAuthIdentitySnapshot,
  );
  return (
    <AiChatWidgetSession
      key={authIdentity ?? 'guest'}
      authIdentity={authIdentity}
      open={open}
      setOpen={setOpen}
    />
  );
}

function AiChatWidgetSession({
  authIdentity,
  open,
  setOpen,
}: {
  authIdentity: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const authenticated = authIdentity !== null;
  const requestGenerationRef = useRef(0);
  const [conversation, setConversation] = useState<ChatConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (
    current: ChatConversationDetail,
    client: boolean,
    generation = requestGenerationRef.current,
    resumedOperations: ChatOperation[] | null = null,
  ) => {
    const page = client
      ? await listClientChatMessagesApi(current.id, { limit: MESSAGE_LIMIT })
      : await listGuestChatMessagesApi(current.id, { limit: MESSAGE_LIMIT });
    if (generation !== requestGenerationRef.current) return;
    const ordered = [...page.data].reverse();
    setMessages(resumedOperations
      ? reconcileResumedOperations(ordered, resumedOperations)
      : ordered);
  }, []);

  const loadConversation = useCallback(async () => {
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    setLoading(true);
    setError(null);
    const client = authenticated;
    try {
      let current: ChatConversationDetail;
      let resumedOperations: ChatOperation[] | null = null;
      const pendingResume = client ? readPendingChatResume() : null;
      if (pendingResume) {
        try {
          const claimed = await claimGuestChatConversationApi(pendingResume);
          current = claimed;
          resumedOperations = claimed.resumedOperations ?? [];
          clearPendingChatResume();
        } catch {
          if (generation === requestGenerationRef.current) setError(translate(locale, 'chat.error.claim'));
          return;
        }
      } else {
        try {
          current = client
            ? await getCurrentClientChatConversationApi()
            : await getCurrentGuestChatConversationApi();
        } catch (currentError) {
          const canBootstrap = currentError instanceof ApiError
            && (currentError.status === 404 || (!client && currentError.status === 401));
          if (!canBootstrap) throw currentError;
          const guest = await createGuestChatConversationApi({ language: locale });
          if (client) {
            const claimed = await claimGuestChatConversationApi(guest.id);
            current = claimed;
            resumedOperations = claimed.resumedOperations ?? [];
          } else {
            current = guest;
          }
        }
      }
      if (generation !== requestGenerationRef.current) return;
      setConversation(current);
      await loadMessages(current, client, generation, resumedOperations);
    } catch (loadError) {
      if (client && loadError instanceof ApiError && loadError.status === 401) clearAuth();
      else if (generation === requestGenerationRef.current) setError(translate(locale, 'chat.error.load'));
    } finally {
      if (generation === requestGenerationRef.current) setLoading(false);
    }
  }, [authenticated, loadMessages, locale]);

  useEffect(() => {
    const queryResume = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('chat') === 'resume';
    const fromLogin = consumeChatReopen() || queryResume;
    if (!fromLogin) return;
    if (queryResume) removeResumeQuery();
    const timeout = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timeout);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      closeRef.current?.focus();
      void loadConversation();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, loadConversation]);

  useEffect(() => {
    if (!open || !conversation) return;
    const interval = window.setInterval(() => {
      void loadMessages(conversation, authenticated).catch((pollError) => {
        if (authenticated && pollError instanceof ApiError && pollError.status === 401) clearAuth();
        else setError(t('chat.error.poll'));
      });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [authenticated, conversation, loadMessages, open, t]);

  function close() {
    setOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function send(body: string, clientMessageId: string) {
    if (!conversation) return;
    setError(null);
    try {
      const payload = { body, clientMessageId };
      const message = authenticated
        ? await sendClientChatMessageApi(conversation.id, payload)
        : await sendGuestChatMessageApi(conversation.id, payload);
      setMessages((current) => current.some(({ id }) => id === message.id) ? current : [...current, message]);
      window.setTimeout(() => {
        void loadMessages(conversation, authenticated).catch(() => undefined);
      }, 1200);
    } catch (sendError) {
      if (authenticated && sendError instanceof ApiError && sendError.status === 401) clearAuth();
      setError(t('chat.error.send'));
      throw new Error('chat send failed');
    }
  }

  function updateOperation(next: ChatOperation): ChatOperation {
    setMessages((current) => current.map((message) => {
      if (message.kind !== 'ACTION_CARD' || message.metadata?.action !== 'CHAT_OPERATION') return message;
      return message.metadata.operation.id === next.id
        ? { ...message, metadata: { action: 'CHAT_OPERATION', operation: next } }
        : message;
    }));
    return next;
  }

  function loginForOperation() {
    if (!conversation || !savePendingChatResume(conversation.id)) {
      setError(t('chat.error.resume'));
      return;
    }
    router.push('/login?redirect=%2F%3Fchat%3Dresume');
  }

  async function guestHandoff(identity: { guestName: string; guestPhone: string }) {
    if (!conversation) return;
    setConversation(await requestGuestChatHandoffApi(conversation.id, identity));
  }

  async function clientHandoff() {
    if (!conversation) return;
    setConversation(await requestClientChatHandoffApi(conversation.id));
  }

  async function retryAssistant(messageId: string) {
    if (!conversation) return;
    setError(null);
    const response = authenticated
      ? await retryClientChatMessageApi(conversation.id, messageId)
      : await retryGuestChatMessageApi(conversation.id, messageId);
    setMessages((current) => current.some(({ id }) => id === response.id)
      ? current
      : [...current, response]);
    await loadMessages(conversation, authenticated);
  }

  const closed = conversation?.status === 'CLOSED';

  return (
    <div className="fixed bottom-4 end-4 z-50 sm:bottom-6 sm:end-6">
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('chat.title')}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          onKeyDown={handleDialogKeyDown}
          className="fixed inset-x-3 bottom-3 flex h-[min(42rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-[1.75rem] border border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-xl)] transition-[opacity,transform] sm:inset-x-auto sm:bottom-24 sm:end-6 sm:h-[min(40rem,calc(100dvh-8rem))] sm:w-[26rem] motion-reduce:transition-none motion-reduce:transform-none"
        >
          <header className="shrink-0 border-b border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-0)] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-[var(--sw-primary-50)] text-[var(--sw-primary-700)]" aria-hidden="true"><Bot size={19} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-extrabold text-[var(--sw-secondary-700)]">{t('chat.title')}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-[0.68rem] leading-4 text-[var(--sw-neutral-500)]">
                  <ShieldCheck size={12} aria-hidden="true" />
                  {t('chat.boundary')}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label={t('chat.close')}
                onClick={close}
                className="grid size-9 place-items-center rounded-full text-[var(--sw-neutral-500)] hover:bg-[var(--sw-neutral-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)]"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </header>
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--error)_20%,transparent)] bg-[color-mix(in_srgb,var(--error)_7%,var(--sw-neutral-0))] px-4 py-2 text-xs font-semibold text-[var(--error)]">
              <span>{error}</span>
              <button type="button" onClick={() => void loadConversation()} className="shrink-0 underline">{t('chat.retry')}</button>
            </div>
          )}
          <ChatMessageList
            messages={messages}
            isAuthenticated={authenticated}
            isLoading={loading}
            onLoginRequired={loginForOperation}
            onAcknowledge={async (id, version) => updateOperation(await acknowledgeChatOperationApi(id, version))}
            onConfirm={async (id, version) => updateOperation(await confirmChatOperationApi(id, version))}
            onDecline={async (id, version) => updateOperation(await declineChatOperationApi(id, version))}
            onGuestHandoff={guestHandoff}
            onClientHandoff={clientHandoff}
            onRetryAssistant={retryAssistant}
          />
          {closed
            ? <p className="border-t border-[var(--sw-neutral-100)] px-4 py-3 text-center text-xs font-semibold text-[var(--sw-neutral-500)]">{t('chat.closed')}</p>
            : <ChatComposer disabled={loading || !conversation} onSend={send} />}
        </div>
      )}
      <button
        ref={launcherRef}
        type="button"
        aria-label={t('chat.launcher')}
        aria-expanded={open}
        onClick={() => open ? close() : setOpen(true)}
        className={`grid size-14 place-items-center rounded-full bg-[var(--sw-secondary-700)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-lg)] transition-[transform,box-shadow] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:transform-none ${open ? 'pointer-events-none opacity-0 sm:pointer-events-auto sm:opacity-100' : ''}`}
      >
        {open ? <X size={22} aria-hidden="true" /> : <MessageCircle size={23} aria-hidden="true" />}
      </button>
    </div>
  );
}

function reconcileResumedOperations(messages: ChatMessage[], resumed: ChatOperation[]): ChatMessage[] {
  const resumedById = new Map(resumed.map((operation) => [operation.id, operation]));
  return messages.flatMap((message) => {
    if (message.kind !== 'ACTION_CARD' || message.metadata?.action !== 'CHAT_OPERATION') return [message];
    const next = resumedById.get(message.metadata.operation.id);
    if (next) return [{ ...message, metadata: { action: 'CHAT_OPERATION' as const, operation: next } }];
    return message.metadata.operation.status === 'AWAITING_AUTH' ? [] : [message];
  });
}

function removeResumeQuery(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('chat');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
