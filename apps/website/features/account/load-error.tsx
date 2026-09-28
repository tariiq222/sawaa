'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { useLocale, useT } from '@/features/locale/locale-provider';

/**
 * Distinct error + retry state for account-area queries. Rendered when a
 * TanStack Query resolves `isError` (expired session, 500, network) so that a
 * failed fetch is never mistaken for a genuinely empty result.
 */
export function AccountLoadError({ onRetry }: { onRetry: () => void }) {
  const tt = useT();
  const locale = useLocale();
  return (
    <div
      role="alert"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="grid min-w-0 place-items-center text-center py-12 px-6 rounded-3xl"
      style={{
        background: 'color-mix(in srgb, var(--error) 5%, var(--sw-neutral-0))',
        border: '1px dashed color-mix(in srgb, var(--error) 30%, transparent)',
      }}
    >
      <div
        className="w-14 h-14 rounded-full grid place-items-center mb-4"
        style={{
          background: 'color-mix(in srgb, var(--error) 12%, transparent)',
          color: 'var(--error)',
        }}
        aria-hidden="true"
      >
        <AlertCircle size={26} />
      </div>
      <p className="min-w-0 w-full text-sm text-[var(--sw-body)] max-w-xs [overflow-wrap:anywhere] leading-relaxed mb-5">
        {tt('account.loadError')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex max-w-full min-w-0 items-center justify-center gap-2 whitespace-normal px-6 py-3 rounded-full font-bold text-sm bg-[var(--sw-primary-500)] text-[var(--on-primary)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform"
      >
        <RotateCcw size={14} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{tt('account.retry')}</span>
      </button>
    </div>
  );
}
