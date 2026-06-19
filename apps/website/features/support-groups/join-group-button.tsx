'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LogIn, Phone, Users } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/features/locale/locale-provider';
import { useCurrentClient } from '@/features/auth/public';
import { initPayment } from '@/features/booking/booking.api';
import { bookGroupSession } from './support-groups.api';

interface Props {
  sessionId: string;
  categoryId: string;
  isFull: boolean;
}

type Status = 'idle' | 'joining' | 'joined' | 'redirecting' | 'full-error' | 'error';

export function JoinGroupButton({ sessionId, categoryId, isFull }: Props) {
  const t = useT();
  const router = useRouter();
  const { client, isLoading } = useCurrentClient();
  const [status, setStatus] = useState<Status>('idle');

  const disabled =
    isLoading || status === 'joining' || status === 'joined' || status === 'redirecting';

  async function handleClick() {
    if (!client) {
      router.push(`/login?redirect=${encodeURIComponent(`/support-groups/${categoryId}`)}`);
      return;
    }
    setStatus('joining');
    try {
      const result = await bookGroupSession(sessionId);
      // Paid sessions return an invoiceId — send the client into the same
      // Moyasar payment flow the regular booking uses. Free sessions (no
      // invoice) are confirmed immediately.
      if (result.invoiceId) {
        setStatus('redirecting');
        const payment = await initPayment(result.invoiceId);
        if (payment.redirectUrl) {
          window.location.href = payment.redirectUrl;
          return;
        }
        setStatus('error');
        return;
      }
      setStatus('joined');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // Backend throws "الجلسة مكتملة العدد" or similar when full
      if (msg.includes('مكتمل') || msg.includes('full') || msg.includes('capacity')) {
        setStatus('full-error');
      } else {
        setStatus('error');
      }
    }
  }

  if (status === 'joined') {
    return (
      <div
        className="inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-[0.875rem] font-bold"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 12%, transparent)', color: 'var(--sw-primary-700)' }}
      >
        <Check className="w-4 h-4" />
        {t('supportGroups.detail.joined')}
      </div>
    );
  }

  if (isFull || status === 'full-error') {
    return (
      <div className="w-full space-y-2 text-center">
        <p className="text-[0.875rem]" style={{ color: 'var(--muted-foreground, #6b7280)' }}>
          {t('supportGroups.detail.sessionFull')}
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-[0.875rem] font-bold transition-all hover:-translate-y-[2px]"
          style={{ background: 'var(--sw-secondary-700)', color: '#fff', boxShadow: 'var(--sw-shadow-md)' }}
        >
          <Phone className="w-4 h-4" />
          {t('supportGroups.detail.contactUs')}
        </Link>
      </div>
    );
  }

  const label = !client
    ? t('supportGroups.detail.loginToJoin')
    : status === 'redirecting'
      ? t('payment.redirecting')
      : status === 'joining'
        ? t('supportGroups.detail.joining')
        : t('supportGroups.detail.join');

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-[0.875rem] font-bold transition-all hover:-translate-y-[2px] disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
        style={{ background: 'var(--sw-primary-500)', color: '#fff', boxShadow: 'var(--sw-shadow-primary)' }}
      >
        {!client ? <LogIn className="w-4 h-4" /> : <Users className="w-4 h-4" />}
        {label}
      </button>
      {status === 'error' ? (
        <p className="mt-2 text-[0.75rem] text-center" style={{ color: 'var(--destructive, #dc2626)' }}>
          {t('supportGroups.detail.joinFailed')}
        </p>
      ) : null}
    </div>
  );
}
