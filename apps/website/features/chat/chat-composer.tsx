'use client';

import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import { Send } from 'lucide-react';

import { useT } from '@/features/locale/locale-provider';

interface ChatComposerProps {
  disabled: boolean;
  onSend: (body: string, clientMessageId: string) => Promise<void>;
}

export function ChatComposer({ disabled, onSend }: ChatComposerProps) {
  const t = useT();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const pendingRef = useRef(false);
  const attemptRef = useRef<{ body: string; clientMessageId: string } | null>(null);

  async function submit() {
    const value = body.trim();
    if (!value || disabled || pendingRef.current) return;
    pendingRef.current = true;
    setSending(true);
    const attempt = attemptRef.current?.body === value
      ? attemptRef.current
      : { body: value, clientMessageId: createClientMessageId() };
    attemptRef.current = attempt;
    try {
      await onSend(value, attempt.clientMessageId);
      attemptRef.current = null;
      setBody('');
    } catch {
      // The parent surface owns the recoverable error. Keep the attempt id.
    } finally {
      pendingRef.current = false;
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-0)] p-3"
    >
      <label htmlFor="sawaa-chat-message" className="sr-only">
        {t('chat.composer.label')}
      </label>
      <textarea
        id="sawaa-chat-message"
        value={body}
        onChange={(event) => {
          if (attemptRef.current && event.target.value.trim() !== attemptRef.current.body) {
            attemptRef.current = null;
          }
          setBody(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        maxLength={2000}
        rows={1}
        placeholder={t('chat.composer.placeholder')}
        className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] px-4 py-2.5 text-sm leading-6 text-[var(--sw-secondary-700)] outline-none transition-[border-color,box-shadow] focus:border-[var(--sw-primary-500)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sw-primary-500)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      />
      <button
        type="submit"
        disabled={disabled || sending || body.trim().length === 0}
        aria-label={sending ? t('chat.composer.sending') : t('chat.composer.send')}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--sw-primary-600)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-sm)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none motion-reduce:transform-none"
      >
        <Send size={17} aria-hidden="true" className="rtl:rotate-180" />
      </button>
    </form>
  );
}

function createClientMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
