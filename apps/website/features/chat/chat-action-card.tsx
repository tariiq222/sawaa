'use client';

import { useRef, useState } from 'react';
import { CalendarClock, Check, CircleAlert, LockKeyhole } from 'lucide-react';

import { useLocale, useT } from '@/features/locale/locale-provider';
import type { ChatOperation } from './chat.types';

type BookingSummary = NonNullable<ChatOperation['summary']['proposedBooking']>;

interface ChatActionCardProps {
  operation: ChatOperation;
  onLoginRequired: (operationId: string) => void;
  onAcknowledge: (operationId: string, expectedVersion: number) => Promise<ChatOperation>;
  onConfirm: (operationId: string, expectedVersion: number) => Promise<ChatOperation>;
  onDecline: (operationId: string, expectedVersion: number) => Promise<ChatOperation>;
}

export function ChatActionCard(props: ChatActionCardProps) {
  const t = useT();
  const locale = useLocale();
  const [operation, setOperation] = useState(props.operation);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  async function run(action: 'acknowledge' | 'confirm' | 'decline') {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const next = action === 'acknowledge'
        ? await props.onAcknowledge(operation.id, operation.version)
        : action === 'confirm'
          ? await props.onConfirm(operation.id, operation.version)
          : await props.onDecline(operation.id, operation.version);
      setOperation(next);
    } catch {
      setError(t('chat.operation.error'));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const terminalLabel = operation.status === 'SUCCEEDED'
    ? t('chat.operation.succeeded')
    : operation.status === 'FAILED'
      ? t('chat.operation.failed')
      : operation.status === 'DECLINED'
        ? t('chat.operation.declined')
        : operation.status === 'EXPIRED'
          ? t('chat.operation.expired')
          : operation.status === 'EXECUTING'
            ? t('chat.operation.executing')
            : null;

  const summary = operation.summary.proposedBooking ?? operation.summary;
  const finalConfirmation = operation.status === 'AWAITING_CONFIRMATION'
    && operation.confirmationCount + 1 >= operation.requiredConfirmations;

  return (
    <section className="overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--sw-primary-500)_25%,transparent)] bg-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-md)]">
      <div className="flex items-center gap-2 border-b border-[var(--sw-neutral-100)] bg-[color-mix(in_srgb,var(--sw-primary-500)_8%,var(--sw-neutral-0))] px-4 py-3 text-sm font-extrabold text-[var(--sw-secondary-700)]">
        <CalendarClock size={17} className="text-[var(--sw-primary-600)]" aria-hidden="true" />
        {finalConfirmation ? t('chat.operation.finalConfirmation') : t('chat.operation.title')}
      </div>
      <div className="space-y-3 p-4">
        <OperationSummary summary={summary} locale={locale} />
        {operation.status === 'AWAITING_EXISTING_BOOKING_ACK' && operation.summary.existingBooking && (
          <div className="rounded-2xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] p-3">
            <p className="mb-2 text-xs font-bold text-[var(--sw-neutral-600)]">{t('chat.operation.existingBooking')}</p>
            <OperationSummary summary={operation.summary.existingBooking} locale={locale} />
          </div>
        )}
        {terminalLabel && (
          <p role="status" className="flex items-center gap-2 text-sm font-bold text-[var(--sw-secondary-700)]">
            {operation.status === 'FAILED' || operation.status === 'EXPIRED'
              ? <CircleAlert size={16} aria-hidden="true" />
              : <Check size={16} aria-hidden="true" />}
            {terminalLabel}
          </p>
        )}
        {operation.status === 'AWAITING_AUTH' && (
          <button
            type="button"
            onClick={() => props.onLoginRequired(operation.id)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sw-secondary-700)] px-4 py-2.5 text-sm font-bold text-[var(--sw-neutral-0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
          >
            <LockKeyhole size={15} aria-hidden="true" />
            {t('chat.operation.login')}
          </button>
        )}
        {operation.status === 'AWAITING_EXISTING_BOOKING_ACK' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void run('acknowledge')}
            className="w-full rounded-full bg-[var(--sw-primary-600)] px-4 py-2.5 text-sm font-bold text-[var(--sw-neutral-0)] disabled:opacity-55"
          >
            {pending ? t('chat.operation.processing') : t('chat.operation.acknowledge')}
          </button>
        )}
        {operation.status === 'AWAITING_CONFIRMATION' && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void run('confirm')}
              className="flex-1 rounded-full bg-[var(--sw-primary-600)] px-4 py-2.5 text-sm font-bold text-[var(--sw-neutral-0)] disabled:opacity-55"
            >
              {pending ? t('chat.operation.processing') : t('chat.operation.confirm')}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void run('decline')}
              className="rounded-full border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-0)] px-4 py-2.5 text-sm font-bold text-[var(--sw-neutral-600)] disabled:opacity-55"
            >
              {t('chat.operation.decline')}
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-xs font-semibold text-[var(--error)]">{error}</p>}
      </div>
    </section>
  );
}

function OperationSummary({ summary, locale }: { summary: BookingSummary; locale: 'ar' | 'en' }) {
  const fields = [summary.serviceName, summary.employeeName, summary.branchName].filter(Boolean);
  if (summary.scheduledAt) {
    const date = new Date(summary.scheduledAt);
    if (!Number.isNaN(date.getTime())) {
      fields.push(new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
        dateStyle: 'medium', timeStyle: 'short',
      }).format(date));
    }
  }
  if (typeof summary.price === 'number') {
    fields.push(new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
      style: 'currency', currency: summary.currency ?? 'SAR',
    }).format(summary.price));
  }
  if (fields.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm text-[var(--sw-neutral-600)]">
      {fields.map((field, index) => <li key={`${field}-${index}`}>{field}</li>)}
    </ul>
  );
}
