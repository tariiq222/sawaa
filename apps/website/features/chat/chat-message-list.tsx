'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Headset, UserRound } from 'lucide-react';

import { useT } from '@/features/locale/locale-provider';
import type { ChatMessage, ChatOperation } from './chat.types';
import { ChatActionCard } from './chat-action-card';
import { GuestHandoffForm } from './guest-handoff-form';
import { SawaaAiIcon } from './sawaa-ai-icon';

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
  onRetryAssistant: (messageId: string) => Promise<void>;
  readOnly?: boolean;
}

const LEGACY_OUT_OF_SCOPE_MESSAGES = new Set([
  'عذرًا، يقتصر دوري على المعلومات الإدارية عن المركز وخدماته. يمكنني عرض خيار التحويل إلى الاستقبال.',
  'Sorry, my role is limited to administrative information about the center and its services. I can offer the option to contact reception.',
]);

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
        <article aria-label={t('chat.sender.assistant')} className="flex items-end justify-start gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-[var(--sw-primary-50)] text-[var(--sw-primary-700)]">
            <SawaaAiIcon size="sm" />
          </span>
          <div className="max-w-[86%] rounded-3xl rounded-es-md border border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-0)] px-4 py-3 text-sm leading-6 text-[var(--sw-secondary-700)] shadow-[var(--sw-shadow-xs)]">
            <p className="mb-1 text-xs font-extrabold text-[var(--sw-primary-700)]">{t('chat.sender.assistant')}</p>
            <p className="font-bold">{t('chat.empty.title')}</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{t('chat.empty.body')}</p>
          </div>
        </article>
      )}
      {props.messages.map((message) => (
        <MessageItem key={message.id} message={message} {...props} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageItem(props: ChatMessageListProps & { message: ChatMessage }) {
  const t = useT();
  const { message } = props;
  const own = message.senderType === 'CLIENT' || message.senderType === 'VISITOR';
  const isSystem = message.senderType === 'SYSTEM' || message.kind === 'SYSTEM_EVENT';
  const isReception = message.senderType === 'STAFF' || message.senderType === 'EMPLOYEE';
  const isOperationResult = message.kind === 'OPERATION_RESULT';
  const body = !own && LEGACY_OUT_OF_SCOPE_MESSAGES.has(message.body)
    ? t('chat.outOfScope')
    : message.body;
  const label = isOperationResult
    ? t('chat.sender.result')
    : own
      ? t('chat.sender.client')
      : isReception
        ? t('chat.sender.reception')
        : t('chat.sender.assistant');

  if (message.kind === 'ACTION_CARD' && message.metadata?.action === 'CHAT_OPERATION') {
    return (
      <section aria-label={t('chat.sender.action')}>
        <ChatActionCard key={`${message.metadata.operation.id}:${message.metadata.operation.version}`} operation={message.metadata.operation} readOnly={props.readOnly} {...props} />
      </section>
    );
  }

  if (isSystem && !isOperationResult) {
    return <p role="status" aria-label={t('chat.sender.system')} className="px-4 py-1 text-center text-xs leading-5 text-[var(--sw-neutral-500)]">{body}</p>;
  }

  return (
    <article aria-label={label} className={`flex items-end gap-2 ${own ? 'justify-end' : 'justify-start'}`}>
      {!own && (
        <span className={`grid size-7 shrink-0 place-items-center rounded-xl ${isReception ? 'bg-[var(--sw-neutral-200)] text-[var(--sw-secondary-700)]' : isOperationResult ? 'bg-[var(--sw-primary-100)] text-[var(--sw-primary-700)]' : 'bg-[var(--sw-primary-50)] text-[var(--sw-primary-700)]'}`}>
          {isReception ? <Headset size={14} aria-hidden="true" /> : isOperationResult ? <BadgeCheck size={14} aria-hidden="true" /> : <SawaaAiIcon size="sm" />}
        </span>
      )}
      <div className={`max-w-[86%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-[var(--sw-shadow-xs)] ${
        own
          ? 'rounded-ee-md bg-[var(--sw-secondary-700)] text-[var(--sw-neutral-0)]'
          : isReception
            ? 'rounded-es-md border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-0)] text-[var(--sw-secondary-700)]'
            : 'rounded-es-md border border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-0)] text-[var(--sw-secondary-700)]'
      }`}>
        {!own && (
          <p className={`mb-1 text-xs font-extrabold ${isReception ? 'text-[var(--sw-secondary-700)]' : 'text-[var(--sw-primary-700)]'}`}>{label}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{body}</p>
        {!props.readOnly && message.kind === 'TEXT' && message.metadata?.action === 'OFFER_HANDOFF' && (
          <HandoffOffer {...props} />
        )}
        {!props.readOnly && message.kind === 'TEXT' && message.metadata?.action === 'ASSISTANT_RECOVERY' && (
          <AssistantRecovery messageId={message.id} canRetry={message.metadata.canRetry} {...props} />
        )}
      </div>
      {own && (
        <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-[var(--sw-neutral-200)] text-[var(--sw-secondary-700)]"><UserRound size={14} aria-hidden="true" /></span>
      )}
    </article>
  );
}

function AssistantRecovery(props: ChatMessageListProps & { messageId: string; canRetry: boolean }) {
  const t = useT();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    if (!props.canRetry || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await props.onRetryAssistant(props.messageId);
    } catch {
      setError(t('chat.recovery.error'));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl bg-[var(--sw-neutral-0)] p-3 text-[var(--sw-secondary-700)]">
      <p className="text-xs font-semibold">{t(props.canRetry ? 'chat.recovery.body' : 'chat.recovery.exhausted')}</p>
      {props.canRetry && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void retry()}
          className="mt-2 w-full rounded-full bg-[var(--sw-primary-600)] px-4 py-2 text-xs font-extrabold text-[var(--sw-neutral-0)] disabled:opacity-55"
        >
          {pending ? t('chat.recovery.retrying') : t('chat.recovery.retry')}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--error)]">{error}</p>}
      <HandoffOffer {...props} />
    </div>
  );
}

function HandoffOffer(props: ChatMessageListProps) {
  const t = useT();
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const pendingRef = useRef(false);

  if (!props.isAuthenticated && showGuestForm) {
    return <GuestHandoffForm onSubmit={props.onGuestHandoff} />;
  }

  async function requestClientHandoff() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await props.onClientHandoff();
      setSent(true);
    } catch {
      setError(t('chat.handoff.error'));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (sent) {
    return <p role="status" className="mt-3 text-sm font-semibold text-[var(--sw-primary-700)]">{t('chat.handoff.sent')}</p>;
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => props.isAuthenticated ? void requestClientHandoff() : setShowGuestForm(true)}
        className="mt-3 w-full rounded-full border border-[color-mix(in_srgb,var(--sw-primary-500)_30%,transparent)] bg-[var(--sw-primary-50)] px-4 py-2 text-xs font-extrabold text-[var(--sw-primary-700)] disabled:opacity-55"
      >
        {pending ? t('chat.handoff.sending') : t('chat.handoff.cta')}
      </button>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--error)]">{error}</p>}
    </>
  );
}
