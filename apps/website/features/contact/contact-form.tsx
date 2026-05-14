'use client';

import { useState } from 'react';
import { submitContactMessage } from './contact.api';

interface Props {
  locale: 'ar' | 'en';
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  subject: string;
  body: string;
}

const INITIAL: FormState = { name: '', phone: '', email: '', subject: '', body: '' };

function validate(state: FormState, locale: 'ar' | 'en') {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (state.name.trim().length < 2) {
    errors.name = locale === 'ar' ? 'الاسم مطلوب' : 'Name is required';
  }
  if (!state.phone && !state.email) {
    errors.email = locale === 'ar' ? 'البريد أو الجوال مطلوب' : 'Email or phone required';
  }
  if (state.body.trim().length < 5) {
    errors.body = locale === 'ar' ? 'الرسالة قصيرة جداً' : 'Message too short';
  }
  return errors;
}

export function ContactForm({ locale }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form, locale);
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
        <h3 style={{ color: 'var(--accent-dark)' }}>
          {locale === 'ar' ? 'تم إرسال رسالتك بنجاح' : 'Your message has been sent'}
        </h3>
        <p>{locale === 'ar' ? 'سنتواصل معك قريباً.' : 'We will contact you soon.'}</p>
        <button onClick={() => setStatus('idle')} style={{ marginTop: '1rem' }}>
          {locale === 'ar' ? 'إرسال رسالة أخرى' : 'Send another message'}
        </button>
      </div>
    );
  }

  const labelFor = (key: keyof FormState) =>
    ({
      name: locale === 'ar' ? 'الاسم' : 'Name',
      phone: locale === 'ar' ? 'الجوال' : 'Phone',
      email: locale === 'ar' ? 'البريد الإلكتروني' : 'Email',
      subject: locale === 'ar' ? 'الموضوع' : 'Subject',
      body: locale === 'ar' ? 'الرسالة' : 'Message',
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
        {status === 'loading'
          ? locale === 'ar'
            ? 'جاري الإرسال...'
            : 'Sending...'
          : locale === 'ar'
            ? 'إرسال'
            : 'Send'}
      </button>
    </form>
  );
}
