import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { CookieConsentBanner } from './cookie-consent-banner';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

function wrap(locale: Locale, children: ReactNode) {
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

function openBanner() {
  act(() => {
    vi.advanceTimersByTime(200);
  });
}

describe('CookieConsentBanner dialog keyboard focus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('appears as a named dialog after the deferral and focuses its first control', () => {
    render(wrap('en', <CookieConsentBanner />));
    expect(screen.queryByRole('dialog')).toBeNull();
    openBanner();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Cookie Settings');
    expect(screen.getByRole('button', { name: 'Learn more' })).toHaveFocus();
  });

  it('dismisses on Escape without recording a consent decision', () => {
    render(wrap('en', <CookieConsentBanner />));
    openBanner();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem('sawaa-consent')).toBeNull();
  });

  it('restores focus to the previously focused element after a decision', () => {
    render(
      wrap(
        'en',
        <>
          <button type="button" data-testid="page-cta">
            Book now
          </button>
          <CookieConsentBanner />
        </>,
      ),
    );
    const cta = screen.getByTestId('page-cta');
    cta.focus();
    openBanner();
    // Opening the banner moves focus inside it.
    expect(screen.getByRole('button', { name: 'Learn more' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cta).toHaveFocus();
  });

  it('traps Tab within the banner', () => {
    render(wrap('en', <CookieConsentBanner />));
    openBanner();
    const accept = screen.getByRole('button', { name: 'Accept all' });
    accept.focus();
    fireEvent.keyDown(accept, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Learn more' })).toHaveFocus();
  });

  it('exposes the focus-trapped banner as a modal dialog', () => {
    render(wrap('en', <CookieConsentBanner />));
    openBanner();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
