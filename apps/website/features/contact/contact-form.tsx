'use client';

import { useState } from 'react';
import { useT } from '@/features/locale/locale-provider';
import { submitContactMessage } from './contact.api';

interface FormState {
  name: string;
  phone: string;
  email: string;
  subject: string;
  body: string;
}

const INITIAL: FormState = { name: '', phone: '', email: '', subject: '', body: '' };

type Translator = ReturnType<typeof useT>;

function validate(state: FormState, t: Translator) {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (state.name.trim().length < 2) {
    errors.name = t('contact.form.errors.name');
  }
  if (!state.phone && !state.email) {
    errors.email = t('contact.form.errors.contact');
  }
  if (state.body.trim().length < 5) {
    errors.body = t('contact.form.errors.body');
  }
  return errors;
}

const inputClass =
  'w-full p-3 rounded-lg border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[var(--bg)]';

export function ContactForm() {
  const t = useT();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form, t);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setStatus('loading');
    setErrorMsg('');
    try {
      await submitContactMessage({
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        subject: form.subject || undefined,
        body: form.body,
      });
      setStatus('success');
      setForm(INITIAL);
    } catch (err) {
      setStatus('error');
      setErrorMsg((err as Error).message);
    }
  };

  if (status === 'success') {
    return (
      <div className="p-8 rounded-2xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-center">
        <h3 className="text-[var(--accent-dark)]">{t('contact.form.success')}</h3>
        <p>{t('contact.form.successDesc')}</p>
        <button onClick={() => setStatus('idle')} className="mt-4">
          {t('contact.form.sendAnother')}
        </button>
      </div>
    );
  }

  const labelFor = (key: keyof FormState) =>
    ({
      name: t('contact.form.name'),
      phone: t('contact.form.phone'),
      email: t('contact.form.email'),
      subject: t('contact.form.subject'),
      body: t('contact.form.body'),
    })[key];

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {(['name', 'phone', 'email', 'subject'] as const).map((key) => (
        <label key={key} className="flex flex-col gap-1 text-start">
          <span className="text-sm text-[var(--primary-dark)]">{labelFor(key)}</span>
          <input
            type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
            value={form[key]}
            onChange={update(key)}
            className={inputClass}
          />
          {errors[key] ? <span className="text-[0.85rem] text-[#d4183d]">{errors[key]}</span> : null}
        </label>
      ))}
      <label className="flex flex-col gap-1 text-start">
        <span className="text-sm text-[var(--primary-dark)]">{labelFor('body')}</span>
        <textarea rows={5} value={form.body} onChange={update('body')} className={inputClass} />
        {errors.body ? <span className="text-[0.85rem] text-[#d4183d]">{errors.body}</span> : null}
      </label>

      {status === 'error' && errorMsg ? (
        <div className="text-sm text-[#d4183d]">{errorMsg}</div>
      ) : null}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-6 py-3 rounded-lg bg-[var(--primary)] text-white border-0 text-base cursor-pointer disabled:cursor-wait"
      >
        {status === 'loading' ? t('contact.form.sending') : t('contact.form.send')}
      </button>
    </form>
  );
}
