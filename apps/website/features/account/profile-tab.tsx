'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentClient, CURRENT_CLIENT_QUERY_KEY } from '@/features/auth/use-current-client';
import { setClient } from '@/features/auth/auth-store';
import { updateMyProfileApi } from './account.api';
import { useT } from '@/features/locale/locale-provider';
import { BadgeCheck, Mail, KeyRound, AlertTriangle } from 'lucide-react';

const INPUT =
  'w-full py-3 px-4 rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] text-base text-[var(--sw-secondary-700)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--sw-primary-500)] focus:bg-[var(--sw-neutral-0)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sw-primary-500)_15%,transparent)]';

function validatePhoneValue(phone: string): boolean {
  // Permissive E.164-style check: optional +, 9-15 digits.
  return /^\+?[0-9]{9,15}$/.test(phone.replace(/[\s-]/g, ''));
}

export function ProfileTab() {
  const tt = useT();
  const queryClient = useQueryClient();
  const { client } = useCurrentClient();

  const [name, setName] = useState(client?.name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!client) {
    return (
      <div className="grid place-items-center py-12 text-sm text-[var(--sw-neutral-500)]">
        {tt('common.loading')}
      </div>
    );
  }

  const phoneChanged = phone.trim() !== (client.phone ?? '');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const nextErrors: { name?: string; phone?: string } = {};
    if (name.trim().length < 2) {
      nextErrors.name = tt('account.profile.nameError');
    }
    if (phone.trim() && !validatePhoneValue(phone.trim())) {
      nextErrors.phone = tt('account.profile.phoneError');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const payload: { name?: string; phone?: string } = {};
      if (name.trim() !== client!.name) payload.name = name.trim();
      if (phoneChanged) payload.phone = phone.trim();
      const updated = await updateMyProfileApi(payload);
      setClient(updated);
      // Update the shared profile query so headers reading useCurrentClient
      // (e.g. the account ProfileCard) refresh without a full reload.
      queryClient.setQueryData(CURRENT_CLIENT_QUERY_KEY, updated);
      setMessage({ ok: true, text: tt('account.profile.saved') });
    } catch {
      setMessage({ ok: false, text: tt('account.profile.saveError') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 p-5 sm:p-6 rounded-2xl bg-[var(--sw-neutral-0)] border border-[var(--sw-neutral-100)]"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-name" className="text-sm font-medium text-[var(--sw-secondary-700)]">
          {tt('account.name')}
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT}
        />
        {errors.name && <p className="text-sm text-[var(--error)]">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-phone" className="text-sm font-medium text-[var(--sw-secondary-700)]">
          {tt('account.phone')}
        </label>
        <input
          id="profile-phone"
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={`${INPUT} text-start`}
        />
        {errors.phone && <p className="text-sm text-[var(--error)]">{errors.phone}</p>}
        {phoneChanged && (
          <p className="inline-flex items-center gap-1.5 text-sm text-[var(--warning)]">
            <AlertTriangle size={13} aria-hidden="true" />
            {tt('account.profile.phoneWarning')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-[var(--sw-secondary-700)]">
          {tt('account.email')}
        </span>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--sw-neutral-50)] border border-[var(--sw-neutral-100)]">
          <Mail size={14} className="shrink-0 text-[var(--sw-neutral-400)]" aria-hidden="true" />
          <span className="text-sm text-[var(--sw-secondary-700)] truncate flex-1" dir="ltr">
            {client.email ?? '—'}
          </span>
          {client.email && (
            <span
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold ${
                client.emailVerified != null
                  ? 'bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]'
                  : 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]'
              }`}
            >
              {client.emailVerified != null && <BadgeCheck size={11} aria-hidden="true" />}
              {client.emailVerified != null ? tt('account.emailVerified') : tt('account.notVerified')}
            </span>
          )}
        </div>
      </div>

      <p className="inline-flex items-center gap-2 text-sm text-[var(--sw-body)]">
        <KeyRound size={13} className="shrink-0 text-[var(--sw-neutral-400)]" aria-hidden="true" />
        {tt('account.profile.passwordNote')}{' '}
        <Link href="/forgot-password" className="font-semibold text-[var(--sw-primary-600)] hover:underline">
          {tt('account.profile.passwordCta')}
        </Link>
      </p>

      {message && (
        <div
          role="status"
          className={`px-3 py-2 rounded-lg text-sm ${
            message.ok
              ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] text-[var(--success)]'
              : 'bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="self-start px-6 py-3 rounded-full font-bold text-sm bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:translate-y-0"
      >
        {saving ? tt('account.profile.saving') : tt('account.profile.save')}
      </button>
    </form>
  );
}
