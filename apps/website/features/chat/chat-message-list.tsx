'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, UserRound } from 'lucide-react';

import { useT } from '@/features/locale/locale-provider';
import type { ChatMessage, ChatOperation } from './chat.types';
import { ChatActionCard } from './chat-action-card';
import { GuestHandoffForm } from './guest-handoff-form';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isAuthenticated: boolean;
  isLoading: boolean;
  onLoginRequired: (operationId: string) => void;
  onAcknowledge: (operationId: string, expectedVersion: number) => Promise<ChatOperation>;
  onConfirm: (operationId: string, expectedVersion: number) => Promise<ChatOperation>;
  onDecline: (operationId: string, expectedVersion: number) => Promise<ChatOperation>;
  onGuestHandoff: (identity: { guestName: string; guestPhone: string }) => Promise<void>;
  onClientHandoff: () => Promise<void>;
}

export function ChatMessageList(props: ChatMessageListProps) {
  const t = useT();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [props.messages]);

  if (props.isLoading) {
    return <div role="status" className="grid flex-1 place-items-center p-8 text-sm text-[var(--sw-neutral-500)]">{t('chat.loading')}</div>;
  }

  return (
    <div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-[var(--sw-neutral-50)] p-4">
      {props.messages.length === 0 && (
        <div className="mx-auto max-w-xs py-10 text-center">
          <span className="mx-auto mb-3 grid size-10 place-items-center rounded-2xl bg-[var(--sw-primary-50)] text-[var(--sw-primary-700)]"><Bot size={19} aria-hidden="true" /></span>
          <p className="font-bold text-[var(--sw-secondary-700)]">{t('chat.empty.title')}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--sw-neutral-500)]">{t('chat.empty.body')}</p>
        </div>
      )}
      {props.messages.map((message) => (
        <MessageItem key={message.id} message={message} {...props} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageItem(props: ChatMessageListProps & { message: ChatMessage }) {
  const { message } = props;
  const own = message.senderType === 'CLIENT' || message.senderType === 'VISITOR';
  const isSystem = message.senderType === 'SYSTEM' || message.kind === 'SYSTEM_EVENT';

  if (message.kind === 'ACTION_CARD' && message.metadata?.action === 'CHAT_OPERATION') {
    return <ChatActionCard key={`${message.metadata.operation.id}:${message.metadata.operation.version}`} operation={message.metadata.operation} {...props} />;
  }

  if (isSystem) {
    return <p className="px-4 py-1 text-center text-xs leading-5 text-[var(--sw-neutral-500)]">{message.body}</p>;
  }

  return (
    <article className={`flex items-end gap-2 ${own ? 'justify-end' : 'justify-start'}`}>
      {!own && (
        <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-[var(--sw-primary-50)] text-[var(--sw-primary-700)]"><Bot size={14} aria-hidden="true" /></span>
      )}
      <div className={`max-w-[86%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-[var(--sw-shadow-xs)] ${
        own
          ? 'rounded-ee-md bg-[var(--sw-secondary-700)] text-[var(--sw-neutral-0)]'
          : 'rounded-es-md border border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-0)] text-[var(--sw-secondary-700)]'
      }`}>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.kind === 'TEXT' && message.metadata?.action === 'OFFER_HANDOFF' && (
          <HandoffOffer {...props} />
        )}
      </div>
      {own && (
        <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-[var(--sw-neutral-200)] text-[var(--sw-secondary-700)]"><UserRound size={14} aria-hidden="true" /></span>
      )}
    </article>
  );
}

function HandoffOffer(props: ChatMessageListProps) {
  const t = useT();
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [pending, setPending] = useState(false);

  if (!props.isAuthenticated && showGuestForm) {
    return <GuestHandoffForm onSubmit={props.onGuestHandoff} />;
  }

  async function requestClientHandoff() {
    if (pending) return;
    setPending(true);
    try {
      await props.onClientHandoff();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => props.isAuthenticated ? void requestClientHandoff() : setShowGuestForm(true)}
      className="mt-3 w-full rounded-full border border-[color-mix(in_srgb,var(--sw-primary-500)_30%,transparent)] bg-[var(--sw-primary-50)] px-4 py-2 text-xs font-extrabold text-[var(--sw-primary-700)] disabled:opacity-55"
    >
      {pending ? t('chat.handoff.sending') : t('chat.handoff.cta')}
    </button>
  );
}
