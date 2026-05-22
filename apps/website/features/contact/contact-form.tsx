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
        style={{
          padding: '2rem',
          borderRadius: '1rem',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          textAlign: 'center',
        }}
      >
        <h3 style={{ color: 'var(--accent-dark)' }}>{t('contact.form.success')}</h3>
        <p>{t('contact.form.successDesc')}</p>
        <button onClick={() => setStatus('idle')} style={{ marginTop: '1rem' }}>
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
    background: 'var(--bg)',
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {(['name', 'phone', 'email', 'subject'] as const).map((key) => (
        <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--primary-dark)' }}>{labelFor(key)}</span>
          <input
            type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
            value={form[key]}
            onChange={update(key)}
            style={inputStyle}
          />
          {errors[key] ? <span style={{ fontSize: '0.85rem', color: '#d4183d' }}>{errors[key]}</span> : null}
        </label>
      ))}
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--primary-dark)' }}>{labelFor('body')}</span>
        <textarea rows={5} value={form.body} onChange={update('body')} style={inputStyle} />
        {errors.body ? <span style={{ fontSize: '0.85rem', color: '#d4183d' }}>{errors.body}</span> : null}
      </label>

      {status === 'error' && errorMsg ? (
        <div style={{ color: '#d4183d', fontSize: '0.9rem' }}>{errorMsg}</div>
      ) : null}

      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '0.5rem',
          background: 'var(--primary)',
          color: 'white',
          border: 'none',
          cursor: status === 'loading' ? 'wait' : 'pointer',
          fontSize: '1rem',
        }}
      >
        {status === 'loading' ? t('contact.form.sending') : t('contact.form.send')}
      </button>
    </form>
  );
}
