import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LocaleProvider } from '@/features/locale/locale-provider';
import * as dictionary from '@/features/locale/dictionary';
import { AccountLoadError } from './load-error';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AccountLoadError', () => {
  it.each([
    ['ar', 'rtl', 'تعذّر تحميل البيانات، حاول مرة أخرى', 'إعادة المحاولة'],
    ['en', 'ltr', "Couldn't load your data. Try again.", 'Retry'],
  ] as const)('announces the %s error and exposes a localized retry action', (locale, dir, message, retryLabel) => {
    const onRetry = vi.fn();
    render(
      <LocaleProvider locale={locale}>
        <AccountLoadError onRetry={onRetry} />
      </LocaleProvider>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('dir', dir);
    expect(within(alert).getByText(message)).toBeVisible();
    const retry = within(alert).getByRole('button', { name: retryLabel });
    expect(retry).toHaveAttribute('type', 'button');
    retry.focus();
    expect(retry).toHaveFocus();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(within(alert).queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps long Arabic and mixed-direction content intact with shrinkable, wrapping containers', () => {
    const longMessage = `تعذّر تحميل البيانات، حاول مرة أخرى. ${'تفاصيل طويلة '.repeat(30)}REF-${'1234567890'.repeat(20)}`;
    const longRetry = 'إعادة محاولة تحميل البيانات مرة أخرى';
    vi.spyOn(dictionary, 't').mockImplementation((_locale, key) =>
      key === 'account.loadError' ? longMessage : longRetry,
    );
    render(<LocaleProvider locale="ar"><AccountLoadError onRetry={vi.fn()} /></LocaleProvider>);

    const alert = screen.getByRole('alert');
    const message = within(alert).getByText(longMessage);
    const retry = within(alert).getByRole('button', { name: longRetry });
    expect(message).toHaveTextContent(longMessage);
    // JSDOM cannot measure layout: these assert the overflow safeguards,
    // not a real-browser visual or 200% zoom result.
    expect(alert).toHaveClass('min-w-0');
    expect(message).toHaveClass('min-w-0', 'w-full', '[overflow-wrap:anywhere]');
    expect(retry).toHaveClass('max-w-full', 'min-w-0', 'whitespace-normal');
    expect(within(retry).getByText(longRetry)).toHaveClass('min-w-0', '[overflow-wrap:anywhere]');
  });
});
