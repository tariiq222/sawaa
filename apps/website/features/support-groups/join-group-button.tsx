'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LogIn, Users } from 'lucide-react';
import { useT } from '@/features/locale/locale-provider';
import { useCurrentClient } from '@/features/auth/public';
import { bookGroupSession } from './support-groups.api';

interface Props {
  sessionId: string;
  categoryId: string;
  isFull: boolean;
  waitlistEnabled: boolean;
}

type Status = 'idle' | 'joining' | 'joined' | 'waitlisted' | 'error';

export function JoinGroupButton({ sessionId, categoryId, isFull, waitlistEnabled }: Props) {
  const t = useT();
  const router = useRouter();
  const { client, isLoading } = useCurrentClient();
  const [status, setStatus] = useState<Status>('idle');

  const disabled = isLoading || status === 'joining' || status === 'joined' || status === 'waitlisted';
  const showWaitlist = isFull && waitlistEnabled;

  async function handleClick() {
    if (!client) {
      router.push(`/login?redirect=${encodeURIComponent(`/support-groups/${categoryId}`)}`);
      return;
    }
    setStatus('joining');
    try {
      const res = await bookGroupSession(sessionId);
      setStatus(res.type === 'WAITLISTED' ? 'waitlisted' : 'joined');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'joined' || status === 'waitlisted') {
    return (
      <div
        className="inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-[0.875rem] font-bold"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 12%, transparent)', color: 'var(--sw-primary-700)' }}
      >
        <Check className="w-4 h-4" />
        {status === 'joined' ? t('supportGroups.detail.joined') : t('supportGroups.detail.waitlisted')}
      </div>
    );
  }

  const label = !client
    ? t('supportGroups.detail.loginToJoin')
    : status === 'joining'
      ? t('supportGroups.detail.joining')
      : showWaitlist
        ? t('supportGroups.joinWaitlist')
        : t('supportGroups.detail.join');

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-[0.875rem] font-bold transition-all hover:-translate-y-[2px] disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
        style={
          showWaitlist
            ? { background: 'var(--sw-secondary-700)', color: '#fff', boxShadow: 'var(--sw-shadow-md)' }
            : { background: 'var(--sw-primary-500)', color: '#fff', boxShadow: 'var(--sw-shadow-primary)' }
        }
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
