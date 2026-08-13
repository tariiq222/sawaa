'use client';

import { MessageCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useLocale, useT } from '@/features/locale/locale-provider';
import { listClientChatConversationsApi, listClientChatMessagesApi } from './chat.api';
import { AccountConversationDetail } from './account-conversation-detail';
import type { ChatMessage, ClientChatConversationSummary } from './chat.types';

const MESSAGE_LIMIT = 100;

export function AccountConversationsTab() {
  const t = useT();
  const locale = useLocale();
  const [conversations, setConversations] = useState<ClientChatConversationSummary[]>([]);
  const [selected, setSelected] = useState<ClientChatConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await listClientChatConversationsApi({ limit: 50 });
      setConversations(page.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadConversations(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  async function openConversation(conversation: ClientChatConversationSummary) {
    setSelected(conversation);
    setMessages([]);
    setDetailLoading(true);
    setDetailError(false);
    try {
      const page = await listClientChatMessagesApi(conversation.id, { limit: MESSAGE_LIMIT });
      setMessages([...page.data].reverse());
    } catch {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  function continueInAssistant() {
    window.dispatchEvent(new Event('sawaa:open-administrative-chat'));
  }

  if (selected) {
    return (
      <AccountConversationDetail
        conversation={selected}
        messages={messages}
        isLoading={detailLoading}
        error={detailError}
        onBack={() => setSelected(null)}
        onContinue={continueInAssistant}
      />
    );
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--sw-neutral-500)]">{t('common.loading')}</p>;
  if (error) {
    return (
      <div role="alert" className="rounded-3xl border border-[color-mix(in_srgb,var(--error)_20%,transparent)] p-5 text-center">
        <p className="text-sm font-semibold text-[var(--error)]">{t('account.conversations.loadError')}</p>
        <button type="button" onClick={() => void loadConversations()} className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-[var(--sw-primary-700)] hover:bg-[var(--sw-primary-50)]">
          <RefreshCw size={15} aria-hidden="true" /> {t('account.retry')}
        </button>
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[var(--sw-neutral-200)] px-5 py-12 text-center">
        <MessageCircle className="mx-auto size-7 text-[var(--sw-neutral-400)]" aria-hidden="true" />
        <h2 className="mt-3 text-base font-extrabold text-[var(--sw-secondary-700)]">{t('account.conversations.emptyTitle')}</h2>
        <p className="mt-1 text-sm text-[var(--sw-neutral-500)]">{t('account.conversations.emptyBody')}</p>
      </div>
    );
  }

  return (
    <ul aria-label={t('account.conversations.title')} className="space-y-3">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <button
            type="button"
            onClick={() => void openConversation(conversation)}
            className="w-full rounded-3xl border border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-0)] p-4 text-start shadow-[var(--sw-shadow-xs)] transition-colors hover:border-[color-mix(in_srgb,var(--sw-primary-500)_35%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)]"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-extrabold text-[var(--sw-secondary-700)]">{t(`account.conversations.status.${conversation.status === 'CLOSED' ? 'closed' : conversation.status === 'STAFF_ACTIVE' ? 'staff' : conversation.status === 'WAITING_FOR_STAFF' ? 'waiting' : 'active'}`)}</span>
              <time className="text-xs text-[var(--sw-neutral-500)]" dateTime={conversation.updatedAt}>{formatDate(conversation.updatedAt, locale)}</time>
            </span>
            <span className="mt-2 block truncate text-sm text-[var(--sw-neutral-600)]">{conversation.lastMessage?.preview || t('account.conversations.noMessages')}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatDate(value: string, locale: 'ar' | 'en'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
