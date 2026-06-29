'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { useT } from '@/features/locale/locale-provider';

/**
 * Distinct error + retry state for account-area queries. Rendered when a
 * TanStack Query resolves `isError` (expired session, 500, network) so that a
 * failed fetch is never mistaken for a genuinely empty result.
 */
export function AccountLoadError({ onRetry }: { onRetry: () => void }) {
  const tt = useT();
  return (
    <div
      role="alert"
      className="grid place-items-center text-center py-12 px-6 rounded-3xl"
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
      <p className="text-sm text-[var(--sw-body)] max-w-xs leading-relaxed mb-5">
        {tt('account.loadError')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform"
      >
        <RotateCcw size={14} aria-hidden="true" />
        {tt('account.retry')}
      </button>
    </div>
  );
}
