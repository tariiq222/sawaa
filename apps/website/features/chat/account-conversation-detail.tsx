'use client';

import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';

import { useLocale, useT } from '@/features/locale/locale-provider';
import { ChatMessageList } from './chat-message-list';
import type { ChatConversationStatus, ChatMessage, ChatOperation, ClientChatConversationSummary } from './chat.types';

interface AccountConversationDetailProps {
  conversation: ClientChatConversationSummary;
  messages: ChatMessage[];
  isLoading: boolean;
  error: boolean;
  onBack: () => void;
  onContinue: () => void;
}

const STATUS_KEY: Record<ChatConversationStatus, 'active' | 'waiting' | 'staff' | 'closed'> = {
  OPEN: 'active',
  AI_ACTIVE: 'active',
  WAITING_FOR_STAFF: 'waiting',
  STAFF_ACTIVE: 'staff',
  CLOSED: 'closed',
};

const noOperation = async (): Promise<ChatOperation> => {
  throw new Error('Conversation history is read-only');
};

const noAction = async (): Promise<void> => {
  throw new Error('Conversation history is read-only');
};

export function AccountConversationDetail(props: AccountConversationDetailProps) {
  const t = useT();
  const locale = useLocale();
  const closed = props.conversation.status === 'CLOSED';

  return (
    <section aria-label={t('account.conversations.detail')} className="overflow-hidden rounded-3xl border border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-sm)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--sw-neutral-100)] px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-bold text-[var(--sw-secondary-700)] hover:bg-[var(--sw-neutral-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)]"
        >
          {locale === 'ar' ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
          {t('account.conversations.back')}
        </button>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${closed
          ? 'bg-[var(--sw-neutral-100)] text-[var(--sw-neutral-600)]'
          : 'bg-[color-mix(in_srgb,var(--sw-primary-500)_12%,transparent)] text-[var(--sw-primary-700)]'}`}
        >
          {t(`account.conversations.status.${STATUS_KEY[props.conversation.status]}`)}
        </span>
      </header>

      {props.error ? (
        <p role="alert" className="p-5 text-sm font-semibold text-[var(--error)]">{t('account.conversations.loadError')}</p>
      ) : (
        <ChatMessageList
          messages={props.messages}
          isAuthenticated
          isLoading={props.isLoading}
          readOnly
          onLoginRequired={() => undefined}
          onAcknowledge={noOperation}
          onConfirm={noOperation}
          onDecline={noOperation}
          onGuestHandoff={noAction}
          onClientHandoff={noAction}
          onRetryAssistant={noAction}
        />
      )}

      {closed ? (
        <p className="border-t border-[var(--sw-neutral-100)] px-4 py-3 text-center text-xs font-semibold text-[var(--sw-neutral-500)]">
          {t('chat.closed')}
        </p>
      ) : (
        <div className="border-t border-[var(--sw-neutral-100)] p-3">
          <button
            type="button"
            onClick={props.onContinue}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sw-secondary-700)] px-4 py-2.5 text-sm font-extrabold text-[var(--sw-neutral-0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
          >
            <MessageCircle size={16} aria-hidden="true" />
            {t('account.conversations.continue')}
          </button>
        </div>
      )}
    </section>
  );
}
