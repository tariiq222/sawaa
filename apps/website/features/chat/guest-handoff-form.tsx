'use client';

import { type FormEvent, useRef, useState } from 'react';

import { normalizeSaudiPhone } from '@/features/auth/auth.schema';
import { useT } from '@/features/locale/locale-provider';

interface GuestHandoffFormProps {
  onSubmit: (identity: { guestName: string; guestPhone: string }) => Promise<void>;
}

export function GuestHandoffForm({ onSubmit }: GuestHandoffFormProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    const guestName = name.trim();
    const guestPhone = normalizeSaudiPhone(phone.trim());
    if (guestName.length < 2) {
      setError(t('chat.handoff.nameError'));
      return;
    }
    if (!guestPhone) {
      setError(t('chat.handoff.phoneError'));
      return;
    }
    pendingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ guestName, guestPhone });
      setSubmitted(true);
    } catch {
      setError(t('chat.handoff.error'));
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <p role="status" className="mt-3 text-sm font-semibold text-[var(--sw-primary-700)]">{t('chat.handoff.sent')}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-2xl bg-[var(--sw-neutral-0)] p-3">
      {error && <p role="alert" className="text-xs font-semibold text-[var(--error)]">{error}</p>}
      <div>
        <label htmlFor="chat-guest-name" className="mb-1 block text-xs font-semibold text-[var(--sw-secondary-700)]">
          {t('chat.handoff.name')}
        </label>
        <input
          id="chat-guest-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          className="w-full rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] px-3 py-2 text-sm outline-none focus:border-[var(--sw-primary-500)] focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)]"
        />
      </div>
      <div>
        <label htmlFor="chat-guest-phone" className="mb-1 block text-xs font-semibold text-[var(--sw-secondary-700)]">
          {t('chat.handoff.phone')}
        </label>
        <input
          id="chat-guest-phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          placeholder="05XXXXXXXX"
          className="w-full rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] px-3 py-2 text-start text-sm outline-none focus:border-[var(--sw-primary-500)] focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)]"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-[var(--sw-secondary-700)] px-4 py-2.5 text-sm font-bold text-[var(--sw-neutral-0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2 disabled:opacity-55"
      >
        {submitting ? t('chat.handoff.sending') : t('chat.handoff.submit')}
      </button>
    </form>
  );
}
