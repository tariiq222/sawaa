'use client';

import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
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
  'w-full px-4 py-3 rounded-xl bg-[var(--sw-neutral-50)] text-[0.938rem] outline-none transition-all ' +
  'border border-[var(--sw-neutral-200)] ' +
  'focus:bg-white focus:border-[var(--sw-primary-400)] ' +
  'focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_12%,transparent)] ' +
  'placeholder:text-[var(--sw-neutral-400)]';

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
      <div
        className="flex flex-col items-center text-center p-8 rounded-2xl"
        style={{
          background: 'var(--sw-primary-50)',
          border: '1px solid color-mix(in srgb, var(--primary) 18%, transparent)',
        }}
      >
        <span
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)' }}
        >
          <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--sw-primary-600)' }} />
        </span>
        <h3
          className="text-[1.125rem] font-extrabold mb-1.5"
          style={{ color: 'var(--sw-secondary-700)' }}
        >
          {t('contact.form.success')}
        </h3>
        <p className="text-[0.875rem] mb-5" style={{ color: 'var(--sw-neutral-600)' }}>
          {t('contact.form.successDesc')}
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="text-[0.875rem] font-bold hover:-translate-y-0.5 transition-transform"
          style={{ color: 'var(--sw-primary-600)' }}
        >
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

  const fieldLabel = (name: keyof FormState, optional: boolean) => (
    <span className="flex items-center gap-2 text-[0.813rem] font-semibold" style={{ color: 'var(--sw-secondary-700)' }}>
      {labelFor(name)}
      {optional ? (
        <span className="text-[0.688rem] font-medium" style={{ color: 'var(--sw-neutral-400)' }}>
          {t('contact.form.optional')}
        </span>
      ) : null}
    </span>
  );

  const fieldError = (name: keyof FormState) =>
    errors[name] ? (
      <span className="text-[0.8rem]" style={{ color: 'var(--sw-error, #d92d20)' }}>
        {errors[name]}
      </span>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {(['name', 'phone', 'email', 'subject'] as const).map((name) => (
          <label key={name} className="flex flex-col gap-1.5 text-start">
            {fieldLabel(name, name !== 'name')}
            <input
              type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
              value={form[name]}
              onChange={update(name)}
              className={inputClass}
            />
            {fieldError(name)}
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1.5 text-start">
        {fieldLabel('body', false)}
        <textarea rows={5} value={form.body} onChange={update('body')} className={`${inputClass} resize-y`} />
        {fieldError('body')}
      </label>

      {status === 'error' && errorMsg ? (
        <div
          className="text-[0.875rem] rounded-xl px-4 py-3"
          style={{
            color: 'var(--sw-error, #d92d20)',
            background: 'color-mix(in srgb, #d92d20 8%, transparent)',
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-full text-white font-extrabold text-[0.938rem] border-0 cursor-pointer transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-wait disabled:translate-y-0"
        style={{
          background: 'linear-gradient(135deg, var(--sw-primary-500) 0%, var(--sw-primary-600) 100%)',
          boxShadow: 'var(--sw-shadow-primary)',
        }}
      >
        {status === 'loading' ? t('contact.form.sending') : t('contact.form.send')}
        {status === 'loading' ? null : <Send className="w-4 h-4" />}
      </button>
    </form>
  );
}
